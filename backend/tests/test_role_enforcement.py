"""
Role Enforcement, Authorization Guards, and Separation of Duties Tests.
Verifies Phase 3 requirements:
- Four roles only: AICTE_ADMIN, INSTITUTION_OFFICER, VERIFICATION_OFFICER, APPROVING_AUTHORITY
- Server-side RBAC: Unauthenticated requests return 401; unauthorized roles return 403
- Institution isolation: Institution Officers cannot access other institutions' data
- Verification and Approval permissions are strictly separated
- Separation of duties: Submitters CANNOT verify or approve their own submissions
- Client-supplied role and institution parameters are never trusted
"""

import os
import tempfile
import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import get_db
from app.models.enums import UserRole, FDRStatus
from app.models.institution import Institution
from app.models.user import User
from app.models.fdr import FDR
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token
from app.main import app


@pytest.fixture(scope="module")
def setup_db():
    """Initializes a temporary database with migrations and seeded records."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    apply_migrations(engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    seed_database(session)
    session.close()

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield engine, TestingSession
    app.dependency_overrides.clear()
    engine.dispose()
    try:
        if os.path.exists(db_path):
            os.remove(db_path)
    except Exception:
        pass


@pytest.fixture
def client(setup_db):
    return TestClient(app)


def get_token_for(user: User) -> str:
    return create_access_token({
        "sub": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "institution_id": user.institution_id,
    })


# -----------------------------------------------------------------------------
# 1. Unauthenticated Requests Return 401
# -----------------------------------------------------------------------------

@pytest.mark.parametrize(
    "method,endpoint",
    [
        ("get", "/api/v1/institutions"),
        ("get", "/api/v1/institutions/1"),
        ("get", "/api/v1/verifications/pending"),
        ("post", "/api/v1/fdrs/1/verify"),
        ("post", "/api/v1/fdrs/1/approval"),
    ],
)
def test_unauthenticated_requests_return_401(client, method, endpoint):
    """Verifies that all protected endpoints reject anonymous calls with 401 Unauthorized."""
    if method == "get":
        res = client.get(endpoint)
    else:
        res = client.post(endpoint, json={})
    assert res.status_code == 401
    assert "WWW-Authenticate" in res.headers


# -----------------------------------------------------------------------------
# 2. Institution Officer Role & Isolation Enforcements
# -----------------------------------------------------------------------------

def test_institution_officer_list_scoped_to_own_institution(client, setup_db):
    """Asserts that Institution Officer list query returns ONLY their own institution."""
    _, TestingSession = setup_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    token = get_token_for(officer_a)

    res = client.get("/api/v1/institutions", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["id"] == officer_a.institution_id
    assert data[0]["name"] == "St. Xavier's Engineering College"
    session.close()


def test_cross_institution_access_denied_for_institution_officer(client, setup_db):
    """Enforces server-side isolation: Officer from Inst A cannot view Inst B."""
    _, TestingSession = setup_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()
    token = get_token_for(officer_a)

    # Access own institution -> 200 OK
    res_own = client.get(
        f"/api/v1/institutions/{officer_a.institution_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_own.status_code == 200

    # Access other institution -> 403 Forbidden
    res_other = client.get(
        f"/api/v1/institutions/{inst_b.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_other.status_code == 403
    assert "another institution" in res_other.json()["detail"].lower()
    session.close()


def test_institution_officer_forbidden_from_verification_and_approval(client, setup_db):
    """Asserts Institution Officers cannot call verification or approval endpoints."""
    _, TestingSession = setup_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    fdr = session.query(FDR).first()
    token = get_token_for(officer_a)

    # 1. Attempt to view pending queue -> 403 Forbidden
    res_queue = client.get(
        "/api/v1/verifications/pending",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_queue.status_code == 403

    # 2. Attempt to verify -> 403 Forbidden
    res_verif = client.post(
        f"/api/v1/fdrs/{fdr.id}/verify",
        headers={"Authorization": f"Bearer {token}"},
        json={"decision": "VERIFIED"},
    )
    assert res_verif.status_code == 403

    # 3. Attempt to approve -> 403 Forbidden
    res_appr = client.post(
        f"/api/v1/fdrs/{fdr.id}/approval",
        headers={"Authorization": f"Bearer {token}"},
        json={"decision": "APPROVED"},
    )
    assert res_appr.status_code == 403
    session.close()


# -----------------------------------------------------------------------------
# 3. Verification Officer Permissions & Separation
# -----------------------------------------------------------------------------

def test_verification_officer_permitted_scrutiny_and_forbidden_approval(client, setup_db):
    """Asserts Verification Officer can access queue and verify, but CANNOT approve."""
    _, TestingSession = setup_db
    session = TestingSession()
    verif = session.query(User).filter_by(role=UserRole.VERIFICATION_OFFICER.value).first()
    fdr = session.query(FDR).filter_by(status=FDRStatus.CORRECTION_REQUIRED.value).first()
    token = get_token_for(verif)

    # 1. Pending queue -> Permitted
    res_queue = client.get(
        "/api/v1/verifications/pending",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_queue.status_code == 200

    # 2. View institutions across system -> Permitted
    res_inst = client.get(
        "/api/v1/institutions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_inst.status_code == 200
    assert len(res_inst.json()) >= 2

    # 3. Record verification -> Permitted (as long as not submitter)
    res_verif = client.post(
        f"/api/v1/fdrs/{fdr.id}/verify",
        headers={"Authorization": f"Bearer {token}"},
        json={"decision": "VERIFIED", "remarks": "Scrutiny check verified"},
    )
    assert res_verif.status_code == 200
    assert res_verif.json()["decision"] == "VERIFIED"

    # 4. Attempt approval -> Strictly 403 Forbidden (Verifiers cannot approve!)
    res_appr = client.post(
        f"/api/v1/fdrs/{fdr.id}/approval",
        headers={"Authorization": f"Bearer {token}"},
        json={"decision": "APPROVED"},
    )
    assert res_appr.status_code == 403
    assert "not authorized to approve" in res_appr.json()["detail"].lower()
    session.close()


# -----------------------------------------------------------------------------
# 4. Approving Authority Permissions & Separation
# -----------------------------------------------------------------------------

def test_approving_authority_permitted_approval_and_forbidden_scrutiny(client, setup_db):
    """Asserts Approving Authority can approve, but CANNOT perform scrutiny/verification."""
    _, TestingSession = setup_db
    session = TestingSession()
    approver = session.query(User).filter_by(role=UserRole.APPROVING_AUTHORITY.value).first()
    fdr = session.query(FDR).filter_by(status=FDRStatus.PENDING_APPROVAL.value).first()
    token = get_token_for(approver)

    # 1. Attempt verification scrutiny -> Strictly 403 Forbidden
    res_verif = client.post(
        f"/api/v1/fdrs/{fdr.id}/verify",
        headers={"Authorization": f"Bearer {token}"},
        json={"decision": "VERIFIED"},
    )
    assert res_verif.status_code == 403
    assert "not authorized to perform verification" in res_verif.json()["detail"].lower()

    # 2. Record approval decision -> Permitted
    res_appr = client.post(
        f"/api/v1/fdrs/{fdr.id}/approval",
        headers={"Authorization": f"Bearer {token}"},
        json={"decision": "APPROVED", "remarks": "Council approval granted"},
    )
    assert res_appr.status_code == 200
    assert res_appr.json()["decision"] == "APPROVED"
    assert res_appr.json()["new_status"] == FDRStatus.ACTIVE.value
    session.close()


# -----------------------------------------------------------------------------
# 5. Separation of Duties Enforcements
# -----------------------------------------------------------------------------

def test_submitter_cannot_verify_own_submission(client, setup_db):
    """Separation of duties: A Verification Officer who submitted an FDR cannot verify it."""
    _, TestingSession = setup_db
    session = TestingSession()
    verif = session.query(User).filter_by(role=UserRole.VERIFICATION_OFFICER.value).first()
    inst = session.query(Institution).first()

    # Create an FDR submitted by the verification officer
    self_submitted_fdr = FDR(
        institution_id=inst.id,
        fdr_number="FDR-SELF-SUBMITTED-001",
        bank_name="Test Bank",
        branch="Test Branch",
        ifsc="TEST0001234",
        amount=1000000.0,
        issue_date=date(2025, 1, 1),
        maturity_date=date(2026, 1, 1),
        status=FDRStatus.UNDER_VERIFICATION.value,
        created_by_id=verif.id,
    )
    session.add(self_submitted_fdr)
    session.commit()
    fdr_id = self_submitted_fdr.id
    token = get_token_for(verif)

    # Attempt self-verification -> 403 Forbidden
    res = client.post(
        f"/api/v1/fdrs/{fdr_id}/verify",
        headers={"Authorization": f"Bearer {token}"},
        json={"decision": "VERIFIED"},
    )
    assert res.status_code == 403
    assert "separation of duties violation" in res.json()["detail"].lower()
    session.close()


def test_submitter_cannot_approve_own_submission(client, setup_db):
    """Separation of duties: An Approving Authority who submitted an FDR cannot approve it."""
    _, TestingSession = setup_db
    session = TestingSession()
    approver = session.query(User).filter_by(role=UserRole.APPROVING_AUTHORITY.value).first()
    inst = session.query(Institution).first()

    # Create an FDR submitted by the approving authority
    self_submitted_fdr = FDR(
        institution_id=inst.id,
        fdr_number="FDR-SELF-SUBMITTED-002",
        bank_name="Test Bank",
        branch="Test Branch",
        ifsc="TEST0001234",
        amount=2000000.0,
        issue_date=date(2025, 1, 1),
        maturity_date=date(2026, 1, 1),
        status=FDRStatus.PENDING_APPROVAL.value,
        created_by_id=approver.id,
    )
    session.add(self_submitted_fdr)
    session.commit()
    fdr_id = self_submitted_fdr.id
    token = get_token_for(approver)

    # Attempt self-approval -> 403 Forbidden
    res = client.post(
        f"/api/v1/fdrs/{fdr_id}/approval",
        headers={"Authorization": f"Bearer {token}"},
        json={"decision": "APPROVED"},
    )
    assert res.status_code == 403
    assert "separation of duties violation" in res.json()["detail"].lower()
    session.close()


# -----------------------------------------------------------------------------
# 6. AICTE Admin Oversight
# -----------------------------------------------------------------------------

def test_aicte_admin_cross_institution_oversight(client, setup_db):
    """Asserts that AICTE Admin has explicit cross-institution view and access."""
    _, TestingSession = setup_db
    session = TestingSession()
    admin = session.query(User).filter_by(role=UserRole.AICTE_ADMIN.value).first()
    token = get_token_for(admin)

    # List all institutions -> Permitted
    res_list = client.get("/api/v1/institutions", headers={"Authorization": f"Bearer {token}"})
    assert res_list.status_code == 200
    assert len(res_list.json()) >= 3

    # View any institution detail -> Permitted
    res_inst = client.get("/api/v1/institutions/1", headers={"Authorization": f"Bearer {token}"})
    assert res_inst.status_code == 200
    session.close()
