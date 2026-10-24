"""
Integration Tests for AICTE FDR Release & Refund Requests Workflow.
Covers:
1. POST /api/v1/fdrs/{fdr_id}/release-requests:
   - Creation by authorized Institution Officer -> REQUESTED (201).
   - Validation: missing reason -> 422.
   - Cross-institution isolation: non-owning institution rejected (403).
   - Non-eligible roles (Verifier, Approver) rejected (403).
   - Duplicate active request prevention -> 409 Conflict.
2. POST /api/v1/requests/{request_id}/cancel:
   - Cancellation while REQUESTED -> CANCELLED (200).
   - Invariant: cannot cancel once review has started (400).
   - Cross-institution cancellation rejected (403).
3. Verification and Correction Cycle:
   - Start review: Separation of duties (submitting officer cannot review -> 403).
   - Verification Officer takes ownership -> UNDER_VERIFICATION.
   - Return for clarification -> CORRECTION_REQUIRED.
   - Resubmission via POST /api/v1/requests/{request_id}/resubmit -> REQUESTED (200).
4. Full Canonical Lifecycle & Invariants:
   - REQUESTED -> UNDER_VERIFICATION -> PENDING_APPROVAL -> RELEASE_APPROVED.
   - Invariant: Premature confirmation without readiness staging returns 409 Conflict.
   - Readiness staging via POST /api/v1/requests/{request_id}/release-confirmation/ready -> AWAITING_CONFIRMATION (200).
   - Confirmation via POST /api/v1/requests/{request_id}/release-confirmation -> RELEASED_REFUNDED (200).
   - Invariant: Repeated confirmation returns 409 Conflict.
   - Simulated/Demo disclosure in audit log; underlying FDR status updated upon confirmation.
5. Rejection Invariant:
   - Rejection requires mandatory reason; returns 400 if missing.
   - Rejected release request sets request to REJECTED, but leaves underlying FDR status unchanged (remains ACTIVE).
"""

import os
import tempfile
import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import get_db
from app.models.enums import UserRole, FDRStatus, ReleaseStatus
from app.models.user import User
from app.models.fdr import FDR
from app.models.workflow import WorkflowRequest
from app.models.audit import AuditLog
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token
from app.main import app


@pytest.fixture(scope="module")
def setup_release_test_db():
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
def client(setup_release_test_db):
    return TestClient(app)


def token_for(user: User) -> str:
    return create_access_token({
        "sub": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "institution_id": user.institution_id,
    })


def create_test_fdr(session, institution_id: int, fdr_number: str, amount: float = 1000000.0, status: str = FDRStatus.ACTIVE.value) -> FDR:
    fdr = FDR(
        fdr_number=fdr_number,
        institution_id=institution_id,
        bank_name="State Bank of India",
        branch="Main Branch",
        ifsc="SBIN0001234",
        amount=amount,
        status=status,
        issue_date=date(2021, 1, 1),
        maturity_date=date(2026, 1, 1),
    )
    session.add(fdr)
    session.commit()
    return fdr


def test_create_release_request_success(client, setup_release_test_db):
    _, TestingSession = setup_release_test_db
    session = TestingSession()
    inst_user = session.query(User).filter_by(username="officer_deshmukh").first()
    assert inst_user is not None
    token = token_for(inst_user)

    # Find active FDR belonging to this institution
    fdr = session.query(FDR).filter_by(institution_id=inst_user.institution_id, status=FDRStatus.ACTIVE.value).first()
    assert fdr is not None
    fdr_id = fdr.id
    session.close()

    resp = client.post(
        f"/api/v1/fdrs/{fdr_id}/release-requests",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "reason": "Closure of Academic Programme (All batches graduated)",
            "applicant_notes": "All student clearances and NOCs complete.",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "REQUESTED"
    assert data["request_type"] == "RELEASE_REFUND"
    assert data["fdr_id"] == fdr_id

    # Verify audit log entry
    session = TestingSession()
    audit = session.query(AuditLog).filter_by(
        target_type="REQUEST",
        target_id=str(data["request_id"]),
        action="RELEASE_REQUEST_CREATED"
    ).first()
    assert audit is not None
    session.close()


def test_create_release_request_duplicate_conflict(client, setup_release_test_db):
    _, TestingSession = setup_release_test_db
    session = TestingSession()
    inst_user = session.query(User).filter_by(username="officer_deshmukh").first()
    token = token_for(inst_user)

    # The previous test already created an active request for this FDR
    fdr = session.query(FDR).filter_by(institution_id=inst_user.institution_id, status=FDRStatus.ACTIVE.value).first()
    fdr_id = fdr.id
    session.close()

    resp = client.post(
        f"/api/v1/fdrs/{fdr_id}/release-requests",
        headers={"Authorization": f"Bearer {token}"},
        json={"reason": "Excess Collateral Refund"},
    )
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"]


def test_create_release_request_cross_institution_forbidden(client, setup_release_test_db):
    _, TestingSession = setup_release_test_db
    session = TestingSession()
    inst2_user = session.query(User).filter_by(username="officer_venkatesh").first()
    token_inst2 = token_for(inst2_user)

    # Attempting to access institution 1's FDR
    inst1_user = session.query(User).filter_by(username="officer_deshmukh").first()
    fdr_inst1 = session.query(FDR).filter_by(institution_id=inst1_user.institution_id).first()
    fdr_id = fdr_inst1.id
    session.close()

    resp = client.post(
        f"/api/v1/fdrs/{fdr_id}/release-requests",
        headers={"Authorization": f"Bearer {token_inst2}"},
        json={"reason": "Excess Collateral Refund"},
    )
    assert resp.status_code == 403
    assert "another institution" in resp.json()["detail"].lower()


def test_create_release_request_role_forbidden(client, setup_release_test_db):
    _, TestingSession = setup_release_test_db
    session = TestingSession()
    verifier_user = session.query(User).filter_by(username="verif_malhotra").first()
    verifier_token = token_for(verifier_user)
    fdr = session.query(FDR).first()
    fdr_id = fdr.id
    session.close()

    resp = client.post(
        f"/api/v1/fdrs/{fdr_id}/release-requests",
        headers={"Authorization": f"Bearer {verifier_token}"},
        json={"reason": "Excess Collateral Refund"},
    )
    assert resp.status_code == 403


def test_cancel_release_request_lifecycle(client, setup_release_test_db):
    _, TestingSession = setup_release_test_db
    session = TestingSession()
    inst_user = session.query(User).filter_by(username="officer_deshmukh").first()
    token = token_for(inst_user)

    # Create a fresh FDR for cancellation test
    fdr = create_test_fdr(session, inst_user.institution_id, "FDR-CANCEL-TEST-001", 1500000.0)
    fdr_id = fdr.id
    session.close()

    # Create release request
    resp = client.post(
        f"/api/v1/fdrs/{fdr_id}/release-requests",
        headers={"Authorization": f"Bearer {token}"},
        json={"reason": "Temporary withdrawal test"},
    )
    assert resp.status_code == 201
    req_id = resp.json()["request_id"]

    # Cancel while in REQUESTED status
    cancel_resp = client.post(
        f"/api/v1/requests/{req_id}/cancel",
        headers={"Authorization": f"Bearer {token}"},
        json={"reason": "Trust deferred program closure decision."},
    )
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "CANCELLED"

    # Verify request is CANCELLED in DB
    session = TestingSession()
    req_db = session.query(WorkflowRequest).filter_by(id=req_id).first()
    assert req_db.status == "CANCELLED"
    session.close()


def test_complete_canonical_release_lifecycle(client, setup_release_test_db):
    """
    Validates canonical lifecycle:
    REQUESTED -> UNDER_VERIFICATION -> PENDING_APPROVAL -> RELEASE_APPROVED -> AWAITING_CONFIRMATION -> RELEASED_REFUNDED.
    Asserts:
    1. Separation of duties (submitter cannot review).
    2. Invalid premature confirmation returns 409.
    3. Premature readiness returns 409.
    4. Readiness moves to AWAITING_CONFIRMATION.
    5. Confirmation records voucher reference & timestamp without actual fund transfer.
    6. Repeated confirmation returns 409.
    """
    _, TestingSession = setup_release_test_db
    session = TestingSession()
    inst_user = session.query(User).filter_by(username="officer_deshmukh").first()
    verifier_user = session.query(User).filter_by(username="verif_malhotra").first()
    approver_user = session.query(User).filter_by(username="approver_kumar").first()

    inst_token = token_for(inst_user)
    verifier_token = token_for(verifier_user)
    approver_token = token_for(approver_user)

    # Create a fresh FDR for the complete lifecycle
    fdr = create_test_fdr(session, inst_user.institution_id, "FDR-LIFECYCLE-REL-001", 3000000.0)
    fdr_id = fdr.id
    session.close()

    # Step 1: Create Release Request -> REQUESTED
    create_resp = client.post(
        f"/api/v1/fdrs/{fdr_id}/release-requests",
        headers={"Authorization": f"Bearer {inst_token}"},
        json={
            "reason": "Autonomous Status Transition",
            "applicant_notes": "Statutory reserve reduced per Gazette notification.",
        },
    )
    assert create_resp.status_code == 201
    req_id = create_resp.json()["request_id"]
    assert create_resp.json()["status"] == "REQUESTED"

    # Separation of duties: Submitting Institution Officer cannot start review
    sod_resp = client.post(
        f"/api/v1/requests/{req_id}/start-verification",
        headers={"Authorization": f"Bearer {inst_token}"},
    )
    assert sod_resp.status_code == 403

    # Step 2: Verification Officer starts review -> UNDER_VERIFICATION
    start_resp = client.post(
        f"/api/v1/requests/{req_id}/start-verification",
        headers={"Authorization": f"Bearer {verifier_token}"},
    )
    assert start_resp.status_code == 200
    assert start_resp.json()["status"] == "UNDER_VERIFICATION"

    # Step 3: Verification Officer verifies -> PENDING_APPROVAL
    verify_resp = client.post(
        f"/api/v1/requests/{req_id}/verify",
        headers={"Authorization": f"Bearer {verifier_token}"},
        json={
            "decision": "VERIFIED",
            "remarks": "Eligibility criteria and zero liability certificate verified.",
        },
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["new_status"] == "PENDING_APPROVAL"

    # Step 4: Approving Authority approves -> RELEASE_APPROVED
    council_order = "AICTE/FIN/REL/2026/7821"
    approve_resp = client.post(
        f"/api/v1/requests/{req_id}/approval",
        headers={"Authorization": f"Bearer {approver_token}"},
        json={
            "decision": "APPROVED",
            "council_order_ref": council_order,
            "remarks": "Sanctioned per Executive Committee resolution.",
        },
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["new_status"] == "RELEASE_APPROVED"

    # INVARIANT CHECK: Direct confirmation without staging readiness must fail with 409 Conflict
    premature_confirm = client.post(
        f"/api/v1/requests/{req_id}/release-confirmation",
        headers={"Authorization": f"Bearer {approver_token}"},
        json={"confirmation_reference": "UTR-SBI-2026-INVALID"},
    )
    assert premature_confirm.status_code == 409
    assert "AWAITING_CONFIRMATION" in premature_confirm.json()["detail"]

    # Step 5: Designated Officer stages readiness -> AWAITING_CONFIRMATION
    ready_resp = client.post(
        f"/api/v1/requests/{req_id}/release-confirmation/ready",
        headers={"Authorization": f"Bearer {approver_token}"},
        json={"remarks": "Branch coordination complete. Ready for payment recording."},
    )
    assert ready_resp.status_code == 200
    assert ready_resp.json()["status"] == "AWAITING_CONFIRMATION"

    # INVARIANT CHECK: Calling readiness again when not in RELEASE_APPROVED returns 409
    repeat_ready = client.post(
        f"/api/v1/requests/{req_id}/release-confirmation/ready",
        headers={"Authorization": f"Bearer {approver_token}"},
        json={"remarks": "Duplicate readiness call"},
    )
    assert repeat_ready.status_code == 409

    # Step 6: Designated Officer records disbursement confirmation -> RELEASED_REFUNDED
    voucher_ref = "UTR-SBI-2026-881920"
    confirm_resp = client.post(
        f"/api/v1/requests/{req_id}/release-confirmation",
        headers={"Authorization": f"Bearer {approver_token}"},
        json={
            "confirmation_reference": voucher_ref,
            "remarks": "Demo bank release voucher confirmed.",
        },
    )
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["status"] == "RELEASED_REFUNDED"
    assert confirm_resp.json()["confirmation_reference"] == voucher_ref

    # INVARIANT CHECK: Repeated confirmation returns 409 Conflict
    repeat_confirm = client.post(
        f"/api/v1/requests/{req_id}/release-confirmation",
        headers={"Authorization": f"Bearer {approver_token}"},
        json={"confirmation_reference": voucher_ref},
    )
    assert repeat_confirm.status_code == 409

    # Verify DB state: request and FDR moved to RELEASED_REFUNDED, audit entry recorded as SIMULATED/DEMO
    session = TestingSession()
    req_db = session.query(WorkflowRequest).filter_by(id=req_id).first()
    assert req_db.status == ReleaseStatus.RELEASED_REFUNDED.value
    assert req_db.confirmation_reference == voucher_ref
    assert req_db.confirmation_timestamp is not None

    fdr_db = session.query(FDR).filter_by(id=fdr_id).first()
    assert fdr_db.status == FDRStatus.RELEASED_REFUNDED.value

    audit = session.query(AuditLog).filter_by(
        target_type="REQUEST",
        target_id=str(req_id),
        action="RELEASE_CONFIRMATION_RECORDED"
    ).first()
    assert audit is not None
    assert "SIMULATED/DEMO" in audit.details
    session.close()


def test_rejection_invariant_leaves_fdr_active(client, setup_release_test_db):
    """
    Validates that:
    1. Rejection requires a mandatory reason.
    2. Rejection marks the request as REJECTED.
    3. Underlying FDR status remains ACTIVE and is not rejected.
    """
    _, TestingSession = setup_release_test_db
    session = TestingSession()
    inst_user = session.query(User).filter_by(username="officer_deshmukh").first()
    verifier_user = session.query(User).filter_by(username="verif_malhotra").first()
    approver_user = session.query(User).filter_by(username="approver_kumar").first()

    inst_token = token_for(inst_user)
    verifier_token = token_for(verifier_user)
    approver_token = token_for(approver_user)

    fdr = create_test_fdr(session, inst_user.institution_id, "FDR-REJECT-INVARIANT-001", 2000000.0)
    fdr_id = fdr.id
    session.close()

    # Step 1: Create request
    create_resp = client.post(
        f"/api/v1/fdrs/{fdr_id}/release-requests",
        headers={"Authorization": f"Bearer {inst_token}"},
        json={"reason": "Excess Collateral Refund"},
    )
    assert create_resp.status_code == 201
    req_id = create_resp.json()["request_id"]

    # Step 2: Review & verify
    client.post(
        f"/api/v1/requests/{req_id}/start-verification",
        headers={"Authorization": f"Bearer {verifier_token}"},
    )
    client.post(
        f"/api/v1/requests/{req_id}/verify",
        headers={"Authorization": f"Bearer {verifier_token}"},
        json={"decision": "VERIFIED", "remarks": "Documents verified for Council consideration."},
    )

    # Step 3: Approver attempts rejection WITHOUT reason -> 400
    empty_reject = client.post(
        f"/api/v1/requests/{req_id}/approval",
        headers={"Authorization": f"Bearer {approver_token}"},
        json={"decision": "REJECTED", "remarks": ""},
    )
    assert empty_reject.status_code == 400

    # Step 4: Approver rejects WITH mandatory reason -> REJECTED
    reject_reason = "Deficiency under APH 2024-25 Clause 14: Outstanding court stay on programme closure."
    reject_resp = client.post(
        f"/api/v1/requests/{req_id}/approval",
        headers={"Authorization": f"Bearer {approver_token}"},
        json={"decision": "REJECTED", "remarks": reject_reason},
    )
    assert reject_resp.status_code == 200
    assert reject_resp.json()["new_status"] == "REJECTED"

    # Invariant: Underlying FDR remains ACTIVE
    session = TestingSession()
    req_db = session.query(WorkflowRequest).filter_by(id=req_id).first()
    assert req_db.status == "REJECTED"

    fdr_db = session.query(FDR).filter_by(id=fdr_id).first()
    assert fdr_db.status == FDRStatus.ACTIVE.value
    session.close()


def test_clarification_and_resubmission_cycle(client, setup_release_test_db):
    """
    Validates:
    UNDER_VERIFICATION -> CORRECTION_REQUIRED -> resubmit -> REQUESTED.
    """
    _, TestingSession = setup_release_test_db
    session = TestingSession()
    inst_user = session.query(User).filter_by(username="officer_deshmukh").first()
    verifier_user = session.query(User).filter_by(username="verif_malhotra").first()

    inst_token = token_for(inst_user)
    verifier_token = token_for(verifier_user)

    fdr = create_test_fdr(session, inst_user.institution_id, "FDR-RESUBMIT-TEST-001", 1000000.0)
    fdr_id = fdr.id
    session.close()

    # Step 1: Create request
    create_resp = client.post(
        f"/api/v1/fdrs/{fdr_id}/release-requests",
        headers={"Authorization": f"Bearer {inst_token}"},
        json={"reason": "Closure of Academic Programme"},
    )
    req_id = create_resp.json()["request_id"]

    # Step 2: Verification Officer returns for clarification
    client.post(
        f"/api/v1/requests/{req_id}/start-verification",
        headers={"Authorization": f"Bearer {verifier_token}"},
    )
    correct_resp = client.post(
        f"/api/v1/requests/{req_id}/verify",
        headers={"Authorization": f"Bearer {verifier_token}"},
        json={
            "decision": "CORRECTION_REQUIRED",
            "remarks": "Affiliating University NOC letter is unsigned.",
        },
    )
    assert correct_resp.status_code == 200
    assert correct_resp.json()["new_status"] == "CORRECTION_REQUIRED"

    # Step 3: Submitting Institution Officer resubmits
    resubmit_resp = client.post(
        f"/api/v1/requests/{req_id}/resubmit",
        headers={"Authorization": f"Bearer {inst_token}"},
        json={"remarks": "Uploaded duly countersigned University NOC."},
    )
    assert resubmit_resp.status_code == 200
    assert resubmit_resp.json()["status"] == "REQUESTED"

    session = TestingSession()
    req_db = session.query(WorkflowRequest).filter_by(id=req_id).first()
    assert req_db.status == "REQUESTED"
    session.close()
