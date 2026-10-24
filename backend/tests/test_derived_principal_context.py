"""
Dedicated Tests for Deriving institution_id and created_by from Authenticated Principal.
Verifies Phase 3, Task 4 in PROJECT_PLAN.md:
- For INSTITUTION_OFFICER, always derive institution_id and created_by_id from the authenticated user.
- Reject or safely ignore client-supplied values that attempt to select another institution or impersonate another creator.
- Apply the same protection to relevant submission and workflow operations (never trust frontend IDs).
- Enforce separation of duties, history tracking, and institution isolation.
- Add tests for:
  1. Forged institution IDs (ignored/overridden with authenticated user's institution).
  2. Forged creator IDs (ignored/overridden with authenticated user's ID).
  3. Missing institution assignments (403 Forbidden).
  4. Valid submissions by officers from different institutions (isolation maintained).
  5. Workflow action principal attribution (submit, start-verification, verify, approval, upload).
  6. Unit checks for derive_institution_id and derive_creator_id helpers.
"""

import os
import io
import tempfile
import pytest
from datetime import date
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import get_db
from app.models.enums import UserRole, FDRStatus, ProvenanceSource
from app.models.institution import Institution
from app.models.user import User
from app.models.fdr import FDR, FieldProvenance
from app.models.document import DocumentVersion
from app.models.workflow import StatusTransitionHistory, VerificationRecord, ApprovalRecord
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token, hash_password
from app.auth import derive_institution_id, derive_creator_id
from app.main import app

VALID_PDF_BYTES = b"%PDF-1.4\n1 0 obj<</Title (Test Principal)>>endobj\n%%EOF"


@pytest.fixture(scope="module")
def setup_derived_db():
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
def client(setup_derived_db):
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
# 1. Helper Unit Tests: derive_institution_id and derive_creator_id
# -----------------------------------------------------------------------------

def test_derive_creator_id_success(setup_derived_db):
    """Verifies derive_creator_id extracts user.id directly."""
    _, TestingSession = setup_derived_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    assert officer is not None

    derived_id = derive_creator_id(officer)
    assert derived_id == officer.id
    session.close()


def test_derive_creator_id_unauthenticated_or_invalid():
    """Verifies derive_creator_id raises 401 Unauthorized for empty or invalid principal."""
    with pytest.raises(HTTPException) as exc:
        derive_creator_id(None)
    assert exc.value.status_code == 401

    dummy = User(id=None, username="orphan", email="orphan@aicte.gov.in", role=UserRole.AICTE_ADMIN.value)
    with pytest.raises(HTTPException) as exc2:
        derive_creator_id(dummy)
    assert exc2.value.status_code == 401


def test_derive_institution_id_assigned_officer(setup_derived_db):
    """Verifies derive_institution_id succeeds for assigned institution officer."""
    _, TestingSession = setup_derived_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    assert derive_institution_id(officer) == officer.institution_id
    session.close()


def test_derive_institution_id_missing_assignment():
    """Verifies derive_institution_id raises 403 Forbidden for unassigned officer."""
    unassigned = User(
        id=998,
        username="unassigned_officer",
        email="unassigned@test.in",
        role=UserRole.INSTITUTION_OFFICER.value,
        institution_id=None,
    )
    with pytest.raises(HTTPException) as exc:
        derive_institution_id(unassigned)
    assert exc.value.status_code == 403
    assert "no assigned institution" in exc.value.detail


def test_derive_institution_id_non_officer_role(setup_derived_db):
    """Verifies derive_institution_id raises 400 Bad Request for non-institution roles."""
    _, TestingSession = setup_derived_db
    session = TestingSession()
    admin = session.query(User).filter_by(role=UserRole.AICTE_ADMIN.value).first()
    verifier = session.query(User).filter_by(role=UserRole.VERIFICATION_OFFICER.value).first()

    with pytest.raises(HTTPException) as exc1:
        derive_institution_id(admin)
    assert exc1.value.status_code == 400

    with pytest.raises(HTTPException) as exc2:
        derive_institution_id(verifier)
    assert exc2.value.status_code == 400
    session.close()


# -----------------------------------------------------------------------------
# 2. Forged institution_id in Create Payload
# -----------------------------------------------------------------------------

def test_create_fdr_safely_ignores_forged_institution_id(client, setup_derived_db):
    """
    Institution Officer A attempts to submit an FDR with institution_id belonging to Inst B.
    The server safely ignores the forged ID and derives institution_id strictly from the principal.
    """
    _, TestingSession = setup_derived_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()

    payload = {
        "fdr_number": "FDR-FORGE-INST-001",
        "bank_name": "State Bank of India",
        "branch": "Fort Branch",
        "ifsc": "SBIN0000300",
        "amount": 750000.0,
        "issue_date": "2026-01-10",
        "maturity_date": "2027-01-10",
        "institution_id": inst_b.id,  # Tampering attempt
    }

    res = client.post(
        "/api/v1/fdrs",
        headers={"Authorization": f"Bearer {token_for(officer_a)}"},
        json=payload,
    )
    assert res.status_code == 201
    fdr_id = res.json()["fdr_id"]

    created_fdr = session.query(FDR).filter_by(id=fdr_id).first()
    assert created_fdr is not None
    # Derived from authenticated principal, NOT forged payload
    assert created_fdr.institution_id == officer_a.institution_id
    assert created_fdr.institution_id != inst_b.id
    assert created_fdr.created_by_id == officer_a.id
    session.close()


# -----------------------------------------------------------------------------
# 3. Forged created_by / created_by_id in Create Payload
# -----------------------------------------------------------------------------

def test_create_fdr_safely_ignores_forged_creator_id(client, setup_derived_db):
    """
    Institution Officer A attempts to set created_by_id to another user ID in the payload.
    The server safely overrides it with the authenticated user ID and logs provenance accordingly.
    """
    _, TestingSession = setup_derived_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()

    payload = {
        "fdr_number": "FDR-FORGE-CREATOR-002",
        "bank_name": "Canara Bank",
        "branch": "Cantonment",
        "ifsc": "CNRB0001001",
        "amount": 600000.0,
        "issue_date": "2026-02-01",
        "maturity_date": "2027-02-01",
        "created_by_id": 9999,  # Impersonation attempt
        "created_by": 8888,     # Secondary impersonation attempt
    }

    res = client.post(
        "/api/v1/fdrs",
        headers={"Authorization": f"Bearer {token_for(officer_a)}"},
        json=payload,
    )
    assert res.status_code == 201
    fdr_id = res.json()["fdr_id"]

    created_fdr = session.query(FDR).filter_by(id=fdr_id).first()
    assert created_fdr is not None
    # Created by authenticated principal
    assert created_fdr.created_by_id == officer_a.id
    assert created_fdr.created_by_id != 9999

    # Provenance record must also reflect authentic creator ID
    prov = session.query(FieldProvenance).filter_by(fdr_id=fdr_id).first()
    assert prov is not None
    assert prov.actor_id == officer_a.id
    assert prov.actor_id != 9999
    session.close()


# -----------------------------------------------------------------------------
# 4. Officer Missing Institution Assignment
# -----------------------------------------------------------------------------

def test_officer_without_institution_assignment_cannot_create_fdr(client, setup_derived_db):
    """
    An Institution Officer account with no institution_id assigned is denied with 403 Forbidden.
    """
    _, TestingSession = setup_derived_db
    session = TestingSession()

    unassigned_user = User(
        username="unassigned_officer_test",
        email="unassigned_test@aicte-demo.edu",
        full_name="Unassigned Officer",
        role=UserRole.INSTITUTION_OFFICER.value,
        institution_id=None,  # Missing assignment
        hashed_password=hash_password("DevSecret123!"),
    )
    session.add(unassigned_user)
    session.commit()

    payload = {
        "fdr_number": "FDR-NO-INST-003",
        "bank_name": "Punjab National Bank",
        "branch": "Headquarters",
        "ifsc": "PUNB0000100",
        "amount": 500000.0,
        "issue_date": "2026-01-01",
        "maturity_date": "2027-01-01",
    }

    res = client.post(
        "/api/v1/fdrs",
        headers={"Authorization": f"Bearer {token_for(unassigned_user)}"},
        json=payload,
    )
    assert res.status_code == 403
    assert "no assigned institution" in res.json()["detail"].lower()
    session.close()


# -----------------------------------------------------------------------------
# 5. Valid Submissions by Officers from Different Institutions
# -----------------------------------------------------------------------------

def test_valid_submissions_by_officers_from_different_institutions(client, setup_derived_db):
    """
    Verifies that:
    - Officer A (Institution A) creates FDR A with derived institution A and creator A.
    - Officer B (Institution B) creates FDR B with derived institution B and creator B.
    - Officer A submits FDR A successfully.
    - Officer B submits FDR B successfully.
    - Cross-submission attempts (Officer A submitting FDR B, Officer B submitting FDR A) are rejected with 403.
    """
    _, TestingSession = setup_derived_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    officer_b = session.query(User).filter_by(username="officer_venkatesh").first()
    inst_a = session.query(Institution).filter_by(id=officer_a.institution_id).first()
    inst_b = session.query(Institution).filter_by(id=officer_b.institution_id).first()

    assert inst_a.id != inst_b.id

    # 1. Officer A creates FDR A
    payload_a = {
        "fdr_number": "FDR-INST-A-001",
        "bank_name": "State Bank of India",
        "branch": "St. Xaviers Branch",
        "ifsc": "SBIN0000111",
        "amount": 1000000.0,
        "issue_date": "2026-03-01",
        "maturity_date": "2027-03-01",
    }
    res_a = client.post("/api/v1/fdrs", headers={"Authorization": f"Bearer {token_for(officer_a)}"}, json=payload_a)
    assert res_a.status_code == 201
    fdr_a_id = res_a.json()["fdr_id"]

    # 2. Officer B creates FDR B
    payload_b = {
        "fdr_number": "FDR-INST-B-001",
        "bank_name": "Canara Bank",
        "branch": "BMSCE Branch",
        "ifsc": "CNRB0000222",
        "amount": 2000000.0,
        "issue_date": "2026-03-01",
        "maturity_date": "2027-03-01",
    }
    res_b = client.post("/api/v1/fdrs", headers={"Authorization": f"Bearer {token_for(officer_b)}"}, json=payload_b)
    assert res_b.status_code == 201
    fdr_b_id = res_b.json()["fdr_id"]

    # 3. Verify Database Isolation and Principal Attribution
    fdr_a = session.query(FDR).filter_by(id=fdr_a_id).first()
    fdr_b = session.query(FDR).filter_by(id=fdr_b_id).first()

    assert fdr_a.institution_id == inst_a.id
    assert fdr_a.created_by_id == officer_a.id

    assert fdr_b.institution_id == inst_b.id
    assert fdr_b.created_by_id == officer_b.id

    # 4. Cross-submission attempt: Officer A attempts to submit FDR B -> 403 Forbidden
    res_cross_a = client.post(
        f"/api/v1/fdrs/{fdr_b_id}/submit",
        headers={"Authorization": f"Bearer {token_for(officer_a)}"},
        json={"remarks": "Malicious cross submission attempt"},
    )
    assert res_cross_a.status_code == 403

    # 5. Cross-submission attempt: Officer B attempts to submit FDR A -> 403 Forbidden
    res_cross_b = client.post(
        f"/api/v1/fdrs/{fdr_a_id}/submit",
        headers={"Authorization": f"Bearer {token_for(officer_b)}"},
        json={"remarks": "Malicious cross submission attempt"},
    )
    assert res_cross_b.status_code == 403

    # 6. Valid submissions by owning officers
    res_sub_a = client.post(
        f"/api/v1/fdrs/{fdr_a_id}/submit",
        headers={"Authorization": f"Bearer {token_for(officer_a)}"},
        json={"remarks": "Valid submission for FDR A"},
    )
    assert res_sub_a.status_code == 200
    assert res_sub_a.json()["status"] == FDRStatus.SUBMITTED.value

    res_sub_b = client.post(
        f"/api/v1/fdrs/{fdr_b_id}/submit",
        headers={"Authorization": f"Bearer {token_for(officer_b)}"},
        json={"remarks": "Valid submission for FDR B"},
    )
    assert res_sub_b.status_code == 200
    assert res_sub_b.json()["status"] == FDRStatus.SUBMITTED.value

    session.close()


# -----------------------------------------------------------------------------
# 6. Submission & Workflow Principal Attribution Under Client Tampering
# -----------------------------------------------------------------------------

def test_submission_ignores_client_actor_id_tampering(client, setup_derived_db):
    """
    Submitting an FDR with a client-supplied actor_id or institution_id in the body
    strictly records the authenticated user as the actor in status history.
    """
    _, TestingSession = setup_derived_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()

    payload = {
        "fdr_number": "FDR-ACTOR-TAMPER-001",
        "bank_name": "Bank of Baroda",
        "branch": "Nariman Point",
        "ifsc": "BARB0000101",
        "amount": 350000.0,
        "issue_date": "2026-01-01",
        "maturity_date": "2027-01-01",
    }
    create_res = client.post("/api/v1/fdrs", headers={"Authorization": f"Bearer {token_for(officer_a)}"}, json=payload)
    fdr_id = create_res.json()["fdr_id"]

    # Submit with tampered actor_id and institution_id
    sub_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/submit",
        headers={"Authorization": f"Bearer {token_for(officer_a)}"},
        json={"remarks": "Submitting", "actor_id": 9999, "institution_id": 9999},
    )
    assert sub_res.status_code == 200

    # Status history must record officer_a.id, NOT 9999
    hist = (
        session.query(StatusTransitionHistory)
        .filter_by(fdr_id=fdr_id, to_status=FDRStatus.SUBMITTED.value)
        .order_by(StatusTransitionHistory.id.desc())
        .first()
    )
    assert hist is not None
    assert hist.actor_id == officer_a.id
    assert hist.actor_id != 9999
    session.close()


def test_document_upload_ignores_client_uploader_tampering(client, setup_derived_db):
    """
    Uploading a document with client-supplied uploaded_by_id or institution_id form data
    strictly attributes the document version to the authenticated principal.
    """
    _, TestingSession = setup_derived_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()

    # Create FDR
    fdr = FDR(
        institution_id=officer_a.institution_id,
        fdr_number="FDR-DOC-TAMPER-001",
        bank_name="Test Bank",
        branch="Test",
        ifsc="TEST0001",
        amount=500000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2027, 1, 1),
        status=FDRStatus.DRAFT.value,
        created_by_id=officer_a.id,
    )
    session.add(fdr)
    session.commit()

    # Upload with client form values attempting to impersonate uploader 9999
    upload_res = client.post(
        f"/api/v1/fdrs/{fdr.id}/documents",
        headers={"Authorization": f"Bearer {token_for(officer_a)}"},
        files={"file": ("receipt.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        data={"document_type": "FDR_RECEIPT", "uploaded_by_id": "9999", "institution_id": "9999"},
    )
    assert upload_res.status_code == 201

    doc = session.query(DocumentVersion).filter_by(fdr_id=fdr.id).first()
    assert doc is not None
    assert doc.uploaded_by_id == officer_a.id
    assert doc.uploaded_by_id != 9999
    session.close()


def test_workflow_verification_and_approval_principals(client, setup_derived_db):
    """
    Workflow verification and approval operations strictly attribute records
    to the authenticated principal, ignoring client-supplied officer_id / approver_id.
    """
    _, TestingSession = setup_derived_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    verifier = session.query(User).filter_by(username="verif_malhotra").first()
    approver = session.query(User).filter_by(username="approver_kumar").first()

    assert verifier is not None
    assert approver is not None

    # 1. Create and submit FDR
    fdr = FDR(
        institution_id=officer_a.institution_id,
        fdr_number="FDR-WORKFLOW-TAMPER-001",
        bank_name="Test Bank",
        branch="Test",
        ifsc="TEST0001",
        amount=500000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2027, 1, 1),
        status=FDRStatus.SUBMITTED.value,
        created_by_id=officer_a.id,
    )
    session.add(fdr)
    session.commit()

    # 2. Verifier takes ownership with client-supplied actor_id=9999
    start_res = client.post(
        f"/api/v1/fdrs/{fdr.id}/start-verification",
        headers={"Authorization": f"Bearer {token_for(verifier)}"},
        json={"remarks": "Starting verification", "actor_id": 9999},
    )
    assert start_res.status_code == 200

    hist_under_ver = (
        session.query(StatusTransitionHistory)
        .filter_by(fdr_id=fdr.id, to_status=FDRStatus.UNDER_VERIFICATION.value)
        .first()
    )
    assert hist_under_ver is not None
    assert hist_under_ver.actor_id == verifier.id
    assert hist_under_ver.actor_id != 9999

    # 3. Verifier verifies with client-supplied officer_id=9999
    ver_res = client.post(
        f"/api/v1/fdrs/{fdr.id}/verify",
        headers={"Authorization": f"Bearer {token_for(verifier)}"},
        json={"decision": "VERIFIED", "remarks": "Looks good", "officer_id": 9999, "actor_id": 9999},
    )
    assert ver_res.status_code == 200

    ver_rec = session.query(VerificationRecord).filter_by(fdr_id=fdr.id).first()
    assert ver_rec is not None
    assert ver_rec.officer_id == verifier.id
    assert ver_rec.officer_id != 9999

    # 4. Approver approves with client-supplied approver_id=9999
    app_res = client.post(
        f"/api/v1/fdrs/{fdr.id}/approval",
        headers={"Authorization": f"Bearer {token_for(approver)}"},
        json={"decision": "APPROVED", "remarks": "Approved by council", "approver_id": 9999, "actor_id": 9999},
    )
    assert app_res.status_code == 200

    app_rec = session.query(ApprovalRecord).filter_by(fdr_id=fdr.id).first()
    assert app_rec is not None
    assert app_rec.approver_id == approver.id
    assert app_rec.approver_id != 9999
    session.close()
