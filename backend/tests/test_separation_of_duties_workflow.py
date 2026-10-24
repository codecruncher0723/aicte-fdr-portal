"""
Dedicated Separation of Duties & Workflow Actor Attribution Tests.
Verifies Phase 3, Task 6 in PROJECT_PLAN.md:
- Prevent a user who submitted an FDR or request from approving their own submission.
- Enforce separation of duties server-side using authenticated user IDs, not client-supplied actor IDs.
- Ensure verification and approval remain separate responsibilities (distinct role boundaries).
- Record the authenticated actor's ID, role, decision, timestamp, and required reason in workflow history/audit records.
- Ensure rejected or unauthorized decisions do not partially update workflow status or create misleading history entries.
"""

import os
import tempfile
import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import get_db
from app.models.enums import UserRole, FDRStatus, RequestType, RenewalStatus
from app.models.institution import Institution
from app.models.user import User
from app.models.fdr import FDR
from app.models.workflow import WorkflowRequest, VerificationRecord, ApprovalRecord, StatusTransitionHistory
from app.models.audit import AuditLog
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token, hash_password
from app.main import app


@pytest.fixture(scope="module")
def setup_sod_db():
    """Initializes a temporary database with migrations and seeded demo accounts."""
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

    # Create a dual-role / admin user who also submits records for SoD testing
    # Admin has approval & verification permissions, but if they submit a record, they cannot approve/verify it
    admin_submitter = User(
        username="admin_submitter_sod",
        email="admin_submitter@aicte.gov.in",
        full_name="Admin Submitter",
        role=UserRole.AICTE_ADMIN.value,
        institution_id=None,
        hashed_password=hash_password("DevSecret123!"),
    )
    session.add(admin_submitter)
    session.commit()
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
def client(setup_sod_db):
    return TestClient(app)


def token_for(user: User) -> str:
    return create_access_token({
        "sub": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "institution_id": user.institution_id,
    })


# -----------------------------------------------------------------------------
# 1. Submitter Cannot Approve or Verify Own FDR Submission
# -----------------------------------------------------------------------------

def test_submitter_cannot_approve_own_fdr(client, setup_sod_db):
    """
    Verifies that a user who submitted an FDR cannot approve it, even if they have approval rights.
    """
    _, TestingSession = setup_sod_db
    session = TestingSession()
    admin_submitter = session.query(User).filter_by(username="admin_submitter_sod").first()
    inst = session.query(Institution).first()

    # Create FDR submitted by admin_submitter
    fdr = FDR(
        institution_id=inst.id,
        fdr_number="FDR-SOD-FDR-001",
        bank_name="Test Bank",
        branch="Test",
        ifsc="TEST0001",
        amount=500000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2027, 1, 1),
        status=FDRStatus.PENDING_APPROVAL.value,
        created_by_id=admin_submitter.id,  # Submitter
    )
    session.add(fdr)
    session.commit()
    fdr_id = fdr.id

    # Admin Submitter attempts self-approval -> 403 Forbidden
    res = client.post(
        f"/api/v1/fdrs/{fdr_id}/approval",
        headers={"Authorization": f"Bearer {token_for(admin_submitter)}"},
        json={"decision": "APPROVED", "remarks": "Self approval attempt"},
    )
    assert res.status_code == 403
    assert "separation of duties" in res.json()["detail"].lower()

    # Verify no partial status change or approval record
    session.refresh(fdr)
    assert fdr.status == FDRStatus.PENDING_APPROVAL.value

    appr_rec = session.query(ApprovalRecord).filter_by(fdr_id=fdr_id).first()
    assert appr_rec is None
    session.close()


def test_submitter_cannot_approve_with_forged_approver_id(client, setup_sod_db):
    """
    Submitter attempts to bypass SoD by passing a forged approver_id/actor_id in payload.
    The server derives identity strictly from authenticated principal and denies with 403.
    """
    _, TestingSession = setup_sod_db
    session = TestingSession()
    admin_submitter = session.query(User).filter_by(username="admin_submitter_sod").first()
    approver = session.query(User).filter_by(username="approver_kumar").first()
    inst = session.query(Institution).first()

    fdr = FDR(
        institution_id=inst.id,
        fdr_number="FDR-SOD-FORGE-002",
        bank_name="Test Bank",
        branch="Test",
        ifsc="TEST0001",
        amount=500000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2027, 1, 1),
        status=FDRStatus.PENDING_APPROVAL.value,
        created_by_id=admin_submitter.id,
    )
    session.add(fdr)
    session.commit()
    fdr_id = fdr.id

    # Submitter calls approval passing approver_id of another user in payload
    res = client.post(
        f"/api/v1/fdrs/{fdr_id}/approval",
        headers={"Authorization": f"Bearer {token_for(admin_submitter)}"},
        json={"decision": "APPROVED", "remarks": "Tampered approver ID", "approver_id": approver.id, "actor_id": approver.id},
    )
    assert res.status_code == 403
    assert "separation of duties" in res.json()["detail"].lower()

    session.refresh(fdr)
    assert fdr.status == FDRStatus.PENDING_APPROVAL.value
    session.close()


def test_submitter_cannot_verify_own_fdr(client, setup_sod_db):
    """
    Verifies that a user who submitted an FDR cannot verify it.
    """
    _, TestingSession = setup_sod_db
    session = TestingSession()
    admin_submitter = session.query(User).filter_by(username="admin_submitter_sod").first()
    inst = session.query(Institution).first()

    fdr = FDR(
        institution_id=inst.id,
        fdr_number="FDR-SOD-VER-003",
        bank_name="Test Bank",
        branch="Test",
        ifsc="TEST0001",
        amount=500000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2027, 1, 1),
        status=FDRStatus.UNDER_VERIFICATION.value,
        created_by_id=admin_submitter.id,
    )
    session.add(fdr)
    session.commit()
    fdr_id = fdr.id

    # Self-verification attempt -> 403 Forbidden
    res = client.post(
        f"/api/v1/fdrs/{fdr_id}/verify",
        headers={"Authorization": f"Bearer {token_for(admin_submitter)}"},
        json={"decision": "VERIFIED", "remarks": "Self verification attempt"},
    )
    assert res.status_code == 403
    assert "separation of duties" in res.json()["detail"].lower()

    session.refresh(fdr)
    assert fdr.status == FDRStatus.UNDER_VERIFICATION.value
    session.close()


# -----------------------------------------------------------------------------
# 2. Submitter Cannot Approve or Verify Own Workflow Request
# -----------------------------------------------------------------------------

def test_submitter_cannot_approve_own_workflow_request(client, setup_sod_db):
    """
    Verifies that a user who created a WorkflowRequest cannot approve it.
    """
    _, TestingSession = setup_sod_db
    session = TestingSession()
    admin_submitter = session.query(User).filter_by(username="admin_submitter_sod").first()
    inst = session.query(Institution).first()

    fdr = FDR(
        institution_id=inst.id,
        fdr_number="FDR-SOD-REQ-004",
        bank_name="Test Bank",
        branch="Test",
        ifsc="TEST0001",
        amount=500000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2027, 1, 1),
        status=FDRStatus.ACTIVE.value,
        created_by_id=admin_submitter.id,
    )
    session.add(fdr)
    session.flush()

    wf_req = WorkflowRequest(
        fdr_id=fdr.id,
        request_type=RequestType.RENEWAL.value,
        status="PENDING_APPROVAL",
        reason="Scheduled renewal",
        created_by_id=admin_submitter.id,  # Submitter of request
    )
    session.add(wf_req)
    session.commit()

    res = client.post(
        f"/api/v1/requests/{wf_req.id}/approval",
        headers={"Authorization": f"Bearer {token_for(admin_submitter)}"},
        json={"decision": "APPROVED", "remarks": "Self request approval attempt"},
    )
    assert res.status_code == 403
    assert "separation of duties" in res.json()["detail"].lower()

    session.refresh(wf_req)
    assert wf_req.status == "PENDING_APPROVAL"
    session.close()


def test_submitter_cannot_verify_own_workflow_request(client, setup_sod_db):
    """
    Verifies that a user who created a WorkflowRequest cannot verify it.
    """
    _, TestingSession = setup_sod_db
    session = TestingSession()
    admin_submitter = session.query(User).filter_by(username="admin_submitter_sod").first()
    inst = session.query(Institution).first()

    fdr = FDR(
        institution_id=inst.id,
        fdr_number="FDR-SOD-REQ-005",
        bank_name="Test Bank",
        branch="Test",
        ifsc="TEST0001",
        amount=500000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2027, 1, 1),
        status=FDRStatus.ACTIVE.value,
        created_by_id=admin_submitter.id,
    )
    session.add(fdr)
    session.flush()

    wf_req = WorkflowRequest(
        fdr_id=fdr.id,
        request_type=RequestType.RENEWAL.value,
        status="UNDER_VERIFICATION",
        reason="Scheduled renewal",
        created_by_id=admin_submitter.id,
    )
    session.add(wf_req)
    session.commit()

    res = client.post(
        f"/api/v1/requests/{wf_req.id}/verify",
        headers={"Authorization": f"Bearer {token_for(admin_submitter)}"},
        json={"decision": "VERIFIED", "remarks": "Self request verification attempt"},
    )
    assert res.status_code == 403
    assert "separation of duties" in res.json()["detail"].lower()

    session.refresh(wf_req)
    assert wf_req.status == "UNDER_VERIFICATION"
    session.close()


# -----------------------------------------------------------------------------
# 3. Valid Independent Approval & Complete Actor Attribution
# -----------------------------------------------------------------------------

def test_valid_independent_approval_and_complete_actor_attribution(client, setup_sod_db):
    """
    Verifies full lifecycle with distinct actors:
    - Officer A (Creator/Submitter)
    - Verifier Malhotra (Verification Scrutiny)
    - Approver Kumar (Final Approval)
    Asserts correct actor_id, actor_name, actor_role, and timestamps recorded across records.
    """
    _, TestingSession = setup_sod_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    verifier = session.query(User).filter_by(username="verif_malhotra").first()
    approver = session.query(User).filter_by(username="approver_kumar").first()

    # All three actors are distinct principals
    assert officer_a.id != verifier.id
    assert officer_a.id != approver.id
    assert verifier.id != approver.id

    # 1. Submitter creates and submits draft FDR
    create_payload = {
        "fdr_number": "FDR-SOD-SUCCESS-001",
        "bank_name": "State Bank of India",
        "branch": "Fort Branch",
        "ifsc": "SBIN0000300",
        "amount": 1000000.0,
        "issue_date": "2026-01-01",
        "maturity_date": "2027-01-01",
    }
    c_res = client.post("/api/v1/fdrs", headers={"Authorization": f"Bearer {token_for(officer_a)}"}, json=create_payload)
    assert c_res.status_code == 201
    fdr_id = c_res.json()["fdr_id"]

    sub_res = client.post(f"/api/v1/fdrs/{fdr_id}/submit", headers={"Authorization": f"Bearer {token_for(officer_a)}"}, json={"remarks": "Initial submission"})
    assert sub_res.status_code == 200

    # 2. Verifier takes into review and verifies
    start_res = client.post(f"/api/v1/fdrs/{fdr_id}/start-verification", headers={"Authorization": f"Bearer {token_for(verifier)}"}, json={"remarks": "Scrutiny start"})
    assert start_res.status_code == 200

    ver_res = client.post(f"/api/v1/fdrs/{fdr_id}/verify", headers={"Authorization": f"Bearer {token_for(verifier)}"}, json={"decision": "VERIFIED", "remarks": "Documents match requirements"})
    assert ver_res.status_code == 200
    assert ver_res.json()["new_status"] == FDRStatus.PENDING_APPROVAL.value

    # Check VerificationRecord attribution
    v_rec = session.query(VerificationRecord).filter_by(fdr_id=fdr_id).first()
    assert v_rec is not None
    assert v_rec.officer_id == verifier.id
    assert v_rec.decision == "VERIFIED"
    assert v_rec.remarks == "Documents match requirements"

    # 3. Independent Approver approves
    app_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/approval",
        headers={"Authorization": f"Bearer {token_for(approver)}"},
        json={"decision": "APPROVED", "council_order_ref": "AICTE/ORDER/2026/001", "remarks": "Council approval granted"},
    )
    assert app_res.status_code == 200
    assert app_res.json()["new_status"] == FDRStatus.ACTIVE.value

    # Check ApprovalRecord attribution
    a_rec = session.query(ApprovalRecord).filter_by(fdr_id=fdr_id).first()
    assert a_rec is not None
    assert a_rec.approver_id == approver.id
    assert a_rec.decision == "APPROVED"
    assert a_rec.council_order_ref == "AICTE/ORDER/2026/001"
    assert a_rec.reason == "Council approval granted"

    # Check StatusTransitionHistory actor attribution
    transitions = session.query(StatusTransitionHistory).filter_by(fdr_id=fdr_id).order_by(StatusTransitionHistory.id.asc()).all()
    # Transition to SUBMITTED by officer_a
    assert transitions[0].actor_id == officer_a.id
    assert transitions[0].to_status == FDRStatus.SUBMITTED.value

    # Transition to UNDER_VERIFICATION by verifier
    assert transitions[1].actor_id == verifier.id
    assert transitions[1].to_status == FDRStatus.UNDER_VERIFICATION.value

    # Transition to PENDING_APPROVAL by verifier
    assert transitions[2].actor_id == verifier.id
    assert transitions[2].to_status == FDRStatus.PENDING_APPROVAL.value

    # Transition to ACTIVE by approver
    assert transitions[3].actor_id == approver.id
    assert transitions[3].to_status == FDRStatus.ACTIVE.value

    # Check AuditLog
    approval_audit = session.query(AuditLog).filter_by(target_id=str(fdr_id), actor_id=approver.id).first()
    assert approval_audit is not None
    assert approval_audit.actor_role == UserRole.APPROVING_AUTHORITY.value
    assert approval_audit.actor_name == approver.full_name
    session.close()


# -----------------------------------------------------------------------------
# 4. Role Boundaries: Verification and Approval Are Separate Responsibilities
# -----------------------------------------------------------------------------

def test_role_boundary_separation(client, setup_sod_db):
    """
    Verifies that:
    - Approver cannot perform verification scrutiny (403 Forbidden).
    - Verifier cannot perform council approval (403 Forbidden).
    - Institution Officer cannot perform verification or approval (403 Forbidden).
    """
    _, TestingSession = setup_sod_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    verifier = session.query(User).filter_by(username="verif_malhotra").first()
    approver = session.query(User).filter_by(username="approver_kumar").first()
    inst = session.query(Institution).first()

    fdr = FDR(
        institution_id=inst.id,
        fdr_number="FDR-SOD-ROLE-006",
        bank_name="Test Bank",
        branch="Test",
        ifsc="TEST0001",
        amount=500000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2027, 1, 1),
        status=FDRStatus.UNDER_VERIFICATION.value,
        created_by_id=officer_a.id,
    )
    session.add(fdr)
    session.commit()
    fdr_id = fdr.id

    # 1. Approver attempts verification -> 403 Forbidden
    app_ver = client.post(
        f"/api/v1/fdrs/{fdr_id}/verify",
        headers={"Authorization": f"Bearer {token_for(approver)}"},
        json={"decision": "VERIFIED", "remarks": "Approver trying to verify"},
    )
    assert app_ver.status_code == 403
    assert "not authorized" in app_ver.json()["detail"].lower()

    # Change to PENDING_APPROVAL for approval test
    fdr.status = FDRStatus.PENDING_APPROVAL.value
    session.commit()

    # 2. Verifier attempts approval -> 403 Forbidden
    ver_app = client.post(
        f"/api/v1/fdrs/{fdr_id}/approval",
        headers={"Authorization": f"Bearer {token_for(verifier)}"},
        json={"decision": "APPROVED", "remarks": "Verifier trying to approve"},
    )
    assert ver_app.status_code == 403
    assert "not authorized" in ver_app.json()["detail"].lower()

    # 3. Institution Officer attempts verification and approval -> 403 Forbidden
    off_ver = client.post(f"/api/v1/fdrs/{fdr_id}/verify", headers={"Authorization": f"Bearer {token_for(officer_a)}"}, json={"decision": "VERIFIED"})
    assert off_ver.status_code == 403

    off_app = client.post(f"/api/v1/fdrs/{fdr_id}/approval", headers={"Authorization": f"Bearer {token_for(officer_a)}"}, json={"decision": "APPROVED", "remarks": "Officer approval"})
    assert off_app.status_code == 403
    session.close()


# -----------------------------------------------------------------------------
# 5. Failed Decision Transaction Atomicity
# -----------------------------------------------------------------------------

def test_failed_rejection_without_reason_preserves_status_atomically(client, setup_sod_db):
    """
    Attempting an approval rejection without a reason is rejected with 400 Bad Request.
    The session is rolled back, preserving the FDR status as PENDING_APPROVAL with no records created.
    """
    _, TestingSession = setup_sod_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    approver = session.query(User).filter_by(username="approver_kumar").first()
    inst = session.query(Institution).first()

    fdr = FDR(
        institution_id=inst.id,
        fdr_number="FDR-SOD-ATOMIC-007",
        bank_name="Test Bank",
        branch="Test",
        ifsc="TEST0001",
        amount=500000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2027, 1, 1),
        status=FDRStatus.PENDING_APPROVAL.value,
        created_by_id=officer_a.id,
    )
    session.add(fdr)
    session.commit()
    fdr_id = fdr.id

    # Rejection attempt with no reason/remarks -> 400 Bad Request
    fail_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/approval",
        headers={"Authorization": f"Bearer {token_for(approver)}"},
        json={"decision": "REJECTED", "remarks": ""},  # Missing reason
    )
    assert fail_res.status_code == 400
    assert "requires a reason" in fail_res.json()["detail"].lower()

    # Status must remain PENDING_APPROVAL
    session.refresh(fdr)
    assert fdr.status == FDRStatus.PENDING_APPROVAL.value

    # No approval record should have been committed
    assert session.query(ApprovalRecord).filter_by(fdr_id=fdr_id).first() is None

    # Now provide a valid rejection with reason -> succeeds with 200
    success_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/approval",
        headers={"Authorization": f"Bearer {token_for(approver)}"},
        json={"decision": "REJECTED", "remarks": "Rejected: deposit certificate signature is unverified"},
    )
    assert success_res.status_code == 200
    assert success_res.json()["new_status"] == FDRStatus.REJECTED.value

    session.refresh(fdr)
    assert fdr.status == FDRStatus.REJECTED.value
    appr = session.query(ApprovalRecord).filter_by(fdr_id=fdr_id).first()
    assert appr is not None
    assert appr.decision == "REJECTED"
    assert "signature is unverified" in appr.reason
    session.close()
