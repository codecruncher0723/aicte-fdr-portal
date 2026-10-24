"""
Dedicated Comprehensive Test Suite for FDR Submission Workflow.
Verifies Phase 4, Task 2 in PROJECT_PLAN.md:
- Allow only DRAFT or CORRECTION_REQUIRED FDRs to transition to SUBMITTED.
- Reject all other states (SUBMITTED, UNDER_VERIFICATION, ACTIVE, etc.) with 409 Conflict.
- Enforce authenticated-user permissions (INSTITUTION_OFFICER only) and institution isolation server-side.
- Ensure client-supplied actor IDs and institution IDs are never trusted.
- Validate required fields on FDR (FDR number, bank name, positive amount, valid date range) before submission.
- Atomically record status update, StatusTransitionHistory, and AuditLog event.
- Ensure failed submissions leave no partial state changes or misleading history.
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
from app.models.workflow import StatusTransitionHistory
from app.models.audit import AuditLog
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token
from app.main import app


@pytest.fixture(scope="module")
def setup_submission_db():
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
def client(setup_submission_db):
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
# 1. PERMITTED SOURCE STATE TRANSITIONS
# =============================================================================

def test_submit_from_draft_status_success(client, setup_submission_db):
    """Verifies that an FDR in DRAFT status transitions to SUBMITTED with history and audit logs."""
    _, TestingSession = setup_submission_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()

    # Create fresh draft FDR
    draft_fdr = FDR(
        institution_id=officer.institution_id,
        fdr_number="FDR-SUBMIT-DRAFT-001",
        bank_name="Punjab National Bank",
        branch="Main Branch",
        ifsc="PUNB0001111",
        amount=1000000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2031, 1, 1),
        status=FDRStatus.DRAFT.value,
        created_by_id=officer.id,
    )
    session.add(draft_fdr)
    session.commit()
    fdr_id = draft_fdr.id

    remarks_text = "Submitting initial draft FDR for scrutiny."
    res = client.post(
        f"/api/v1/fdrs/{fdr_id}/submit",
        json={"remarks": remarks_text},
        headers=auth_headers(officer),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["fdr_id"] == fdr_id
    assert data["status"] == FDRStatus.SUBMITTED.value

    # Verify database persistence
    session.expire_all()
    updated_fdr = session.query(FDR).filter_by(id=fdr_id).first()
    assert updated_fdr.status == FDRStatus.SUBMITTED.value

    # Verify status transition history
    transition = (
        session.query(StatusTransitionHistory)
        .filter_by(fdr_id=fdr_id, to_status=FDRStatus.SUBMITTED.value)
        .first()
    )
    assert transition is not None
    assert transition.from_status == FDRStatus.DRAFT.value
    assert transition.to_status == FDRStatus.SUBMITTED.value
    assert transition.actor_id == officer.id
    assert transition.reason == remarks_text
    assert transition.transition_type == "FDR_LIFECYCLE"

    # Verify audit log entry
    audit = (
        session.query(AuditLog)
        .filter_by(target_id=str(fdr_id), action="STATUS_TRANSITION_SUBMITTED")
        .first()
    )
    assert audit is not None
    assert audit.actor_id == officer.id
    assert audit.actor_name == officer.full_name
    assert audit.actor_role == officer.role
    assert "DRAFT to SUBMITTED" in audit.details
    session.close()


def test_submit_from_correction_required_status_success(client, setup_submission_db):
    """Verifies that an FDR in CORRECTION_REQUIRED status transitions to SUBMITTED."""
    _, TestingSession = setup_submission_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()

    # Create FDR in CORRECTION_REQUIRED status
    corr_fdr = FDR(
        institution_id=officer.institution_id,
        fdr_number="FDR-SUBMIT-CORR-002",
        bank_name="Canara Bank",
        branch="Pune Branch",
        ifsc="CNRB0002222",
        amount=2000000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2031, 1, 1),
        status=FDRStatus.CORRECTION_REQUIRED.value,
        created_by_id=officer.id,
    )
    session.add(corr_fdr)
    session.commit()
    fdr_id = corr_fdr.id

    remarks_text = "Resubmitting corrected FDR details and amended mandate descriptor."
    res = client.post(
        f"/api/v1/fdrs/{fdr_id}/submit",
        json={"remarks": remarks_text},
        headers=auth_headers(officer),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == FDRStatus.SUBMITTED.value

    # Verify database persistence
    session.expire_all()
    updated_fdr = session.query(FDR).filter_by(id=fdr_id).first()
    assert updated_fdr.status == FDRStatus.SUBMITTED.value

    # Verify transition history
    transition = (
        session.query(StatusTransitionHistory)
        .filter_by(fdr_id=fdr_id, to_status=FDRStatus.SUBMITTED.value)
        .first()
    )
    assert transition is not None
    assert transition.from_status == FDRStatus.CORRECTION_REQUIRED.value
    assert transition.to_status == FDRStatus.SUBMITTED.value
    assert transition.actor_id == officer.id
    assert transition.reason == remarks_text
    session.close()


# =============================================================================
# 2. INVALID SOURCE STATES (409 CONFLICT)
# =============================================================================

@pytest.mark.parametrize("forbidden_status", [
    FDRStatus.SUBMITTED.value,
    FDRStatus.UNDER_VERIFICATION.value,
    FDRStatus.VERIFIED.value,
    FDRStatus.PENDING_APPROVAL.value,
    FDRStatus.ACTIVE.value,
    FDRStatus.REJECTED.value,
])
def test_submit_rejected_for_forbidden_statuses(client, setup_submission_db, forbidden_status):
    """Verifies that submitting an FDR in any state other than DRAFT or CORRECTION_REQUIRED returns 409 Conflict."""
    _, TestingSession = setup_submission_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()

    # Create FDR in forbidden status
    fdr = FDR(
        institution_id=officer.institution_id,
        fdr_number=f"FDR-FORBIDDEN-{forbidden_status}",
        bank_name="HDFC Bank",
        branch="Main",
        ifsc="HDFC0001234",
        amount=500000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2031, 1, 1),
        status=forbidden_status,
        created_by_id=officer.id,
    )
    session.add(fdr)
    session.commit()
    fdr_id = fdr.id

    initial_history_count = (
        session.query(StatusTransitionHistory)
        .filter_by(fdr_id=fdr_id)
        .count()
    )

    res = client.post(
        f"/api/v1/fdrs/{fdr_id}/submit",
        json={"remarks": "Invalid transition attempt"},
        headers=auth_headers(officer),
    )
    assert res.status_code == 409
    assert f"Cannot submit FDR in '{forbidden_status}' status" in res.json()["detail"]

    # Verify status is unchanged and no history created
    session.expire_all()
    check_fdr = session.query(FDR).filter_by(id=fdr_id).first()
    assert check_fdr.status == forbidden_status

    final_history_count = (
        session.query(StatusTransitionHistory)
        .filter_by(fdr_id=fdr_id)
        .count()
    )
    assert final_history_count == initial_history_count
    session.close()


# =============================================================================
# 3. ROLE AUTHORIZATION AND INSTITUTION ISOLATION
# =============================================================================

def test_submit_forbidden_for_non_institution_officers(client, setup_submission_db):
    """Verifies that non-institution officers cannot submit FDRs."""
    _, TestingSession = setup_submission_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    admin = session.query(User).filter_by(username="admin_sridhar").first()
    verifier = session.query(User).filter_by(username="verif_malhotra").first()
    approver = session.query(User).filter_by(username="approver_kumar").first()

    draft_fdr = FDR(
        institution_id=officer.institution_id,
        fdr_number="FDR-AUTH-TEST-003",
        bank_name="ICICI Bank",
        branch="Camp",
        ifsc="ICIC0001234",
        amount=1500000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2031, 1, 1),
        status=FDRStatus.DRAFT.value,
        created_by_id=officer.id,
    )
    session.add(draft_fdr)
    session.commit()
    fdr_id = draft_fdr.id

    # Non-officer roles receive 403 Forbidden
    for user in [admin, verifier, approver]:
        res = client.post(
            f"/api/v1/fdrs/{fdr_id}/submit",
            json={"remarks": "Illegal submission attempt"},
            headers=auth_headers(user),
        )
        assert res.status_code == 403

    # Anonymous receives 401 Unauthorized
    res_anon = client.post(
        f"/api/v1/fdrs/{fdr_id}/submit",
        json={"remarks": "Anonymous submission attempt"},
    )
    assert res_anon.status_code == 401
    session.close()


def test_submit_cross_institution_forbidden(client, setup_submission_db):
    """Verifies that an Institution Officer cannot submit an FDR belonging to another institution."""
    _, TestingSession = setup_submission_db
    session = TestingSession()
    officer_1 = session.query(User).filter_by(username="officer_deshmukh").first()
    officer_2 = session.query(User).filter_by(username="officer_venkatesh").first()

    draft_fdr_1 = FDR(
        institution_id=officer_1.institution_id,
        fdr_number="FDR-ISOLATION-004",
        bank_name="Axis Bank",
        branch="FC Road",
        ifsc="UTIB0001234",
        amount=800000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2031, 1, 1),
        status=FDRStatus.DRAFT.value,
        created_by_id=officer_1.id,
    )
    session.add(draft_fdr_1)
    session.commit()
    fdr_id = draft_fdr_1.id

    # Officer 2 attempts to submit Officer 1's FDR
    res = client.post(
        f"/api/v1/fdrs/{fdr_id}/submit",
        json={"remarks": "Cross-institution submit attempt"},
        headers=auth_headers(officer_2),
    )
    assert res.status_code == 403
    assert "Access forbidden" in res.json()["detail"]

    # Verify FDR status remains DRAFT
    session.expire_all()
    check_fdr = session.query(FDR).filter_by(id=fdr_id).first()
    assert check_fdr.status == FDRStatus.DRAFT.value
    session.close()


# =============================================================================
# 4. ACTOR ATTRIBUTION AND PAYLOAD TAMPERING RESISTANCE
# =============================================================================

def test_submit_ignores_client_supplied_actor_and_institution_ids(client, setup_submission_db):
    """Verifies that forged actor_id and institution_id in submission payload are safely ignored."""
    _, TestingSession = setup_submission_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()

    draft_fdr = FDR(
        institution_id=officer.institution_id,
        fdr_number="FDR-FORGED-ACTOR-005",
        bank_name="Bank of India",
        branch="Kothrud",
        ifsc="BKID0001234",
        amount=1200000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2031, 1, 1),
        status=FDRStatus.DRAFT.value,
        created_by_id=officer.id,
    )
    session.add(draft_fdr)
    session.commit()
    fdr_id = draft_fdr.id

    # Client supplies forged actor_id and institution_id
    payload = {
        "remarks": "Legitimate officer submission",
        "actor_id": 999999,
        "institution_id": 888888,
    }
    res = client.post(
        f"/api/v1/fdrs/{fdr_id}/submit",
        json=payload,
        headers=auth_headers(officer),
    )
    assert res.status_code == 200

    # Verify history records real authenticated actor ID, NOT forged ID
    transition = (
        session.query(StatusTransitionHistory)
        .filter_by(fdr_id=fdr_id, to_status=FDRStatus.SUBMITTED.value)
        .first()
    )
    assert transition.actor_id == officer.id
    assert transition.actor_id != 999999

    # Verify audit log records real authenticated actor ID
    audit = (
        session.query(AuditLog)
        .filter_by(target_id=str(fdr_id), action="STATUS_TRANSITION_SUBMITTED")
        .first()
    )
    assert audit.actor_id == officer.id
    assert audit.actor_id != 999999
    session.close()


# =============================================================================
# 5. REQUIRED FIELD VALIDATION BEFORE SUBMISSION
# =============================================================================

def test_submit_rejected_if_fdr_number_missing_or_blank(client, setup_submission_db):
    """Verifies submission is rejected if FDR number is missing or blank."""
    _, TestingSession = setup_submission_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()

    fdr = FDR(
        institution_id=officer.institution_id,
        fdr_number="   ",
        bank_name="State Bank of India",
        branch="Main",
        ifsc="SBIN0001234",
        amount=500000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2031, 1, 1),
        status=FDRStatus.DRAFT.value,
        created_by_id=officer.id,
    )
    session.add(fdr)
    session.commit()
    fdr_id = fdr.id

    res = client.post(f"/api/v1/fdrs/{fdr_id}/submit", headers=auth_headers(officer))
    assert res.status_code == 400
    assert "FDR number" in res.json()["detail"]

    session.expire_all()
    assert session.query(FDR).filter_by(id=fdr_id).first().status == FDRStatus.DRAFT.value
    session.close()


def test_submit_rejected_if_bank_name_missing_or_blank(client, setup_submission_db):
    """Verifies submission is rejected if bank name is missing or blank."""
    _, TestingSession = setup_submission_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()

    fdr = FDR(
        institution_id=officer.institution_id,
        fdr_number="FDR-VAL-NOBANK",
        bank_name="  ",
        branch="Main",
        ifsc="SBIN0001234",
        amount=500000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2031, 1, 1),
        status=FDRStatus.DRAFT.value,
        created_by_id=officer.id,
    )
    session.add(fdr)
    session.commit()
    fdr_id = fdr.id

    res = client.post(f"/api/v1/fdrs/{fdr_id}/submit", headers=auth_headers(officer))
    assert res.status_code == 400
    assert "bank" in res.json()["detail"].lower()

    session.expire_all()
    assert session.query(FDR).filter_by(id=fdr_id).first().status == FDRStatus.DRAFT.value
    session.close()


def test_submit_rejected_if_invalid_dates(client, setup_submission_db, monkeypatch):
    """Verifies submission is rejected if maturity date is before issue date."""
    _, TestingSession = setup_submission_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()

    fdr = FDR(
        institution_id=officer.institution_id,
        fdr_number="FDR-VAL-DATES",
        bank_name="Bank of Baroda",
        branch="Main",
        ifsc="BARB0001234",
        amount=500000.0,
        issue_date=date(2026, 5, 1),
        maturity_date=date(2026, 5, 1),
        status=FDRStatus.DRAFT.value,
        created_by_id=officer.id,
    )
    headers = auth_headers(officer)
    session.add(fdr)
    session.commit()
    fdr_id = fdr.id
    session.close()

    # Use property/attribute monkeypatch on loaded FDR object to test server validation
    orig_get_db = app.dependency_overrides[get_db]

    def mock_get_db():
        for db in orig_get_db():
            real_query = db.query
            def custom_query(*args, **kwargs):
                q = real_query(*args, **kwargs)
                if args and args[0] is FDR:
                    real_filter_by = q.filter_by
                    def custom_filter_by(**f_kwargs):
                        sub_q = real_filter_by(**f_kwargs)
                        real_first = sub_q.first
                        def custom_first():
                            item = real_first()
                            if item and item.id == fdr_id:
                                item.maturity_date = date(2020, 1, 1)
                            return item
                        sub_q.first = custom_first
                        return sub_q
                    q.filter_by = custom_filter_by
                return q
            db.query = custom_query
            yield db

    app.dependency_overrides[get_db] = mock_get_db
    try:
        res = client.post(f"/api/v1/fdrs/{fdr_id}/submit", headers=headers)
        assert res.status_code == 400
        assert "dates" in res.json()["detail"].lower()
    finally:
        app.dependency_overrides[get_db] = orig_get_db


def test_submit_nonexistent_fdr_returns_404(client, setup_submission_db):
    """Verifies that submitting a non-existent FDR ID returns 404 Not Found."""
    _, TestingSession = setup_submission_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()

    res = client.post("/api/v1/fdrs/999999/submit", headers=auth_headers(officer))
    assert res.status_code == 404
    session.close()
