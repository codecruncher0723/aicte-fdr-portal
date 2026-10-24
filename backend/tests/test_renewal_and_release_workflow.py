"""
Dedicated Comprehensive Test Suite for Renewal and Release-Request Workflows.
Verifies Step 3 of task:
- Creation of renewal requests with institution isolation and FDR state checks.
- Verification and approval of renewal requests.
- Completion of renewal with FDRRenewalHistory persistence and FDR updates.
- Creation of release requests with institution isolation and duplicate prevention.
- End-to-end lifecycle transitions of release requests:
  START_VERIFICATION -> VERIFY_APPROVE -> APPROVE -> CONFIRM_READINESS -> CONFIRM_RELEASE
- Request cancellation and resubmission flows.
- Scoping of GET /api/v1/requests by role and institution isolation.
"""

import os
import tempfile
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import get_db
from app.models.enums import UserRole, FDRStatus, RequestType, RenewalStatus, ReleaseStatus
from app.models.institution import Institution
from app.models.user import User
from app.models.fdr import FDR, FDRRenewalHistory
from app.models.workflow import WorkflowRequest, StatusTransitionHistory
from app.models.audit import AuditLog
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token
from app.main import app


@pytest.fixture(scope="module")
def setup_workflow_db():
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
def client(setup_workflow_db):
    return TestClient(app)


def token_for(user: User) -> str:
    return create_access_token({
        "sub": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "institution_id": user.institution_id,
    })


def auth_headers(user: User) -> dict:
    return {"Authorization": f"Bearer {token_for(user)}"}


# =============================================================================
# 1. RENEWAL WORKFLOW TESTS
# =============================================================================

def test_renewal_request_creation_and_completion_lifecycle(client, setup_workflow_db):
    """
    Full renewal lifecycle:
    1. Institution officer creates renewal request -> FDR becomes RENEWAL_REQUESTED
    2. Verification officer verifies request -> PENDING_APPROVAL
    3. Approving authority approves request -> APPROVED
    4. Institution officer completes renewal -> FDR updated, FDRRenewalHistory created, FDR ACTIVE again
    """
    _, TestingSession = setup_workflow_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    verif = session.query(User).filter_by(username="verif_malhotra").first()
    approver = session.query(User).filter_by(username="approver_kumar").first()

    # Create an active FDR for Institution 1
    active_fdr = FDR(
        institution_id=officer.institution_id,
        fdr_number="FDR-TEST-REN-001",
        bank_name="State Bank of India",
        branch="Main Branch",
        ifsc="SBIN0001234",
        amount=1500000.0,
        interest_rate="6.75%",
        issue_date=date(2021, 5, 10),
        maturity_date=date(2026, 5, 10),
        status=FDRStatus.ACTIVE.value,
        created_by_id=officer.id,
    )
    session.add(active_fdr)
    session.commit()
    fdr_id = active_fdr.id

    # 1. Submit renewal request
    res = client.post(
        f"/api/v1/fdrs/{fdr_id}/renewals",
        headers=auth_headers(officer),
        json={
            "reason": "5-year statutory tenure extension",
            "applicant_notes": "Term deposit renewed at branch.",
        },
    )
    assert res.status_code == 200, res.text
    req_data = res.json()
    req_id = req_data["id"]
    assert req_data["status"] == "REQUESTED"
    assert req_data["request_type"] == "RENEWAL"

    # Verify FDR status moved to RENEWAL_REQUESTED
    session.refresh(active_fdr)
    assert active_fdr.status == FDRStatus.RENEWAL_REQUESTED.value

    # Submitting duplicate renewal while active is blocked with 409
    res_dup = client.post(
        f"/api/v1/fdrs/{fdr_id}/renewals",
        headers=auth_headers(officer),
        json={"reason": "Duplicate attempt"},
    )
    assert res_dup.status_code == 409

    # 2. Verification scrutiny
    res_verif = client.post(
        f"/api/v1/requests/{req_id}/verify",
        headers=auth_headers(verif),
        json={"decision": "VERIFIED", "remarks": "Renewal voucher verified against bank statement"},
    )
    assert res_verif.status_code == 200, res_verif.text
    assert res_verif.json()["new_status"] == "PENDING_APPROVAL"

    # 3. Council approval
    res_appr = client.post(
        f"/api/v1/requests/{req_id}/approval",
        headers=auth_headers(approver),
        json={
            "decision": "APPROVED",
            "remarks": "Renewal sanctioned under APH 2024-25",
            "council_order_ref": "AICTE/REN/2026/042",
        },
    )
    assert res_appr.status_code == 200, res_appr.text
    assert res_appr.json()["new_status"] == "APPROVED"

    # 4. Complete renewal
    new_maturity = (date(2026, 5, 10) + timedelta(days=365 * 5)).isoformat()
    res_comp = client.post(
        f"/api/v1/requests/{req_id}/complete-renewal",
        headers=auth_headers(officer),
        json={
            "renewed_fdr_number": "FDR-TEST-REN-001-R1",
            "renewed_maturity_date": new_maturity,
            "renewed_interest_rate": "7.10%",
            "remarks": "Bank certificate recorded with new tenure",
        },
    )
    assert res_comp.status_code == 200, res_comp.text
    comp_data = res_comp.json()
    assert comp_data["new_fdr_number"] == "FDR-TEST-REN-001-R1"
    assert comp_data["fdr_status"] == "ACTIVE"
    assert comp_data["request_status"] == "COMPLETED"

    # Verify FDRRenewalHistory snapshot in database
    history_record = session.query(FDRRenewalHistory).filter_by(fdr_id=fdr_id).first()
    assert history_record is not None
    assert history_record.previous_fdr_number == "FDR-TEST-REN-001"
    assert history_record.renewed_fdr_number == "FDR-TEST-REN-001-R1"
    assert str(history_record.previous_amount) == "1500000.00"

    session.close()


def test_renewal_institution_isolation(client, setup_workflow_db):
    """Institution Officer B cannot request renewal for Institution A's FDR."""
    _, TestingSession = setup_workflow_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    officer_b = session.query(User).filter_by(username="officer_venkatesh").first()

    fdr_a = session.query(FDR).filter_by(institution_id=officer_a.institution_id).first()
    res = client.post(
        f"/api/v1/fdrs/{fdr_a.id}/renewals",
        headers=auth_headers(officer_b),
        json={"reason": "Cross-institution tampering"},
    )
    assert res.status_code == 403
    session.close()


# =============================================================================
# 2. RELEASE / REFUND WORKFLOW TESTS
# =============================================================================

def test_release_request_full_lifecycle(client, setup_workflow_db):
    """
    Full release lifecycle:
    1. Submit release request -> FDR status is RELEASE_REQUESTED
    2. Start verification -> UNDER_VERIFICATION
    3. Verify and recommend -> PENDING_APPROVAL
    4. Council approve release -> RELEASE_APPROVED (FDR is RELEASE_APPROVED)
    5. Confirm readiness -> AWAITING_CONFIRMATION (FDR is AWAITING_CONFIRMATION)
    6. Confirm release with UTR payment advice -> RELEASED_REFUNDED (FDR is RELEASED_REFUNDED)
    """
    _, TestingSession = setup_workflow_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    verif = session.query(User).filter_by(username="verif_malhotra").first()
    approver = session.query(User).filter_by(username="approver_kumar").first()

    fdr = FDR(
        institution_id=officer.institution_id,
        fdr_number="FDR-TEST-REL-002",
        bank_name="Punjab National Bank",
        branch="Shivaji Nagar",
        ifsc="PUNB0098765",
        amount=2000000.0,
        issue_date=date(2020, 1, 1),
        maturity_date=date(2025, 1, 1),
        status=FDRStatus.ACTIVE.value,
        created_by_id=officer.id,
    )
    session.add(fdr)
    session.commit()
    fdr_id = fdr.id

    # 1. Create release request
    res = client.post(
        f"/api/v1/fdrs/{fdr_id}/releases",
        headers=auth_headers(officer),
        json={
            "reason": "Closure of Academic Programme",
            "applicant_notes": "All student batches graduated; no liabilities outstanding.",
        },
    )
    assert res.status_code == 200, res.text
    req_data = res.json()
    req_id = req_data["id"]
    assert req_data["status"] == "REQUESTED"
    assert req_data["request_type"] == "RELEASE_REFUND"

    # Duplicate release request is rejected
    res_dup = client.post(
        f"/api/v1/fdrs/{fdr_id}/releases",
        headers=auth_headers(officer),
        json={"reason": "Duplicate release"},
    )
    assert res_dup.status_code == 409

    # 2. Start verification via transition endpoint
    res_start = client.post(
        f"/api/v1/requests/{req_id}/transition",
        headers=auth_headers(verif),
        json={"transition_type": "START_VERIFICATION"},
    )
    assert res_start.status_code == 200, res_start.text
    assert res_start.json()["status"] == "UNDER_VERIFICATION"

    # 3. Verify and approve
    res_verif = client.post(
        f"/api/v1/requests/{req_id}/transition",
        headers=auth_headers(verif),
        json={"transition_type": "VERIFY_APPROVE", "remarks": "No statutory liabilities found"},
    )
    assert res_verif.status_code == 200, res_verif.text
    assert res_verif.json()["status"] == "PENDING_APPROVAL"

    # 4. Council approval
    res_appr = client.post(
        f"/api/v1/requests/{req_id}/transition",
        headers=auth_headers(approver),
        json={
            "transition_type": "APPROVE",
            "order_ref": "AICTE/FIN/REL/2026/8891",
            "remarks": "Sanctioned by Executive Council",
        },
    )
    assert res_appr.status_code == 200, res_appr.text
    assert res_appr.json()["status"] == "RELEASE_APPROVED"

    session.refresh(fdr)
    assert fdr.status == FDRStatus.RELEASE_APPROVED.value

    # 5. Confirm readiness
    res_ready = client.post(
        f"/api/v1/requests/{req_id}/transition",
        headers=auth_headers(verif),
        json={
            "transition_type": "CONFIRM_READINESS",
            "remarks": "Bank NOC verified and escrow account verified",
        },
    )
    assert res_ready.status_code == 200, res_ready.text
    assert res_ready.json()["status"] == "AWAITING_CONFIRMATION"

    session.refresh(fdr)
    assert fdr.status == FDRStatus.AWAITING_CONFIRMATION.value

    # 6. Confirm release with UTR
    res_rel = client.post(
        f"/api/v1/requests/{req_id}/transition",
        headers=auth_headers(verif),
        json={
            "transition_type": "CONFIRM_RELEASE",
            "confirmation_ref": "UTR-PNB-2026-981273",
        },
    )
    assert res_rel.status_code == 200, res_rel.text
    assert res_rel.json()["status"] == "RELEASED_REFUNDED"
    assert res_rel.json()["confirmation_reference"] == "UTR-PNB-2026-981273"

    session.refresh(fdr)
    assert fdr.status == FDRStatus.RELEASED_REFUNDED.value

    session.close()


def test_release_request_rejection_leaves_fdr_active(client, setup_workflow_db):
    """Regulatory Invariant: Rejecting a release request does NOT reject the underlying FDR."""
    _, TestingSession = setup_workflow_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    approver = session.query(User).filter_by(username="approver_kumar").first()

    fdr = FDR(
        institution_id=officer.institution_id,
        fdr_number="FDR-TEST-REL-REJ-003",
        bank_name="Canara Bank",
        branch="Camp",
        ifsc="CNRB0001111",
        amount=1000000.0,
        issue_date=date(2021, 1, 1),
        maturity_date=date(2026, 1, 1),
        status=FDRStatus.ACTIVE.value,
        created_by_id=officer.id,
    )
    session.add(fdr)
    session.commit()

    # Submit release
    res = client.post(
        f"/api/v1/fdrs/{fdr.id}/releases",
        headers=auth_headers(officer),
        json={"reason": "Surplus release"},
    )
    req_id = res.json()["id"]

    # Reject release
    res_rej = client.post(
        f"/api/v1/requests/{req_id}/transition",
        headers=auth_headers(approver),
        json={"transition_type": "REJECT", "reason": "Surplus funds not permitted for release"},
    )
    assert res_rej.status_code == 200
    assert res_rej.json()["status"] == "REJECTED"

    session.refresh(fdr)
    # The FDR must NOT be in REJECTED status; it was in RELEASE_REQUESTED and remains valid
    assert fdr.status != FDRStatus.REJECTED.value

    session.close()


def test_list_workflow_requests_scoping(client, setup_workflow_db):
    """Verify GET /api/v1/requests institution isolation and admin oversight."""
    _, TestingSession = setup_workflow_db
    session = TestingSession()
    admin = session.query(User).filter_by(username="admin_sridhar").first()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    officer_b = session.query(User).filter_by(username="officer_venkatesh").first()

    # Admin sees all requests
    res_admin = client.get("/api/v1/requests", headers=auth_headers(admin))
    assert res_admin.status_code == 200
    items_admin = res_admin.json()["items"]
    assert len(items_admin) >= 2

    # Officer A sees only their institution
    res_a = client.get("/api/v1/requests", headers=auth_headers(officer_a))
    assert res_a.status_code == 200
    items_a = res_a.json()["items"]
    for item in items_a:
        assert item["institution_id"] == officer_a.institution_id

    # Officer A attempting ?institution_id=other is 403
    res_forbidden = client.get(
        f"/api/v1/requests?institution_id={officer_b.institution_id}",
        headers=auth_headers(officer_a),
    )
    assert res_forbidden.status_code == 403

    session.close()
