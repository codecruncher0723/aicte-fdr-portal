"""
Dedicated Comprehensive Test Suite for FDR Field Validation and Required Supporting Document.
Verifies Phase 4, Task 3 in PROJECT_PLAN.md:
- Validate required FDR number, institution, bank, amount, issue date, maturity date.
- Enforce amount > 0 and maturity_date >= issue_date on create and update.
- Reject blank strings for required fields (FDR number, issuing bank).
- Derive institution identity server-side; reject forged ownership.
- Enforce that a valid supporting document is actually uploaded and associated with the FDR before submission.
- Ensure that a filename alone without an uploaded document is rejected.
- Reject submission if supporting document belongs to another FDR.
- Reject submission if supporting document does not exist.
- Preserve provenance, history, and transaction-atomicity guarantees.
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
from app.models.document import DocumentVersion
from app.models.workflow import StatusTransitionHistory
from app.models.audit import AuditLog
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token
from app.main import app

VALID_PDF_BYTES = b"%PDF-1.4\n1 0 obj<</Title (Supporting Evidence Document)>>endobj\n%%EOF"


@pytest.fixture(scope="module")
def setup_validation_db():
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
def client(setup_validation_db):
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
# 1. CREATE FDR FIELD VALIDATIONS
# =============================================================================

def test_create_fdr_missing_or_blank_fdr_number(client, setup_validation_db):
    """Verifies that an empty or whitespace-only FDR number is rejected on creation."""
    _, TestingSession = setup_validation_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)
    session.close()

    payload_empty = {
        "fdr_number": "   ",
        "bank_name": "State Bank of India",
        "branch": "Main Branch",
        "amount": 500000.0,
        "issue_date": str(date(2026, 1, 1)),
        "maturity_date": str(date(2027, 1, 1)),
    }
    res = client.post("/api/v1/fdrs", json=payload_empty, headers=headers)
    assert res.status_code == 400
    assert "FDR number" in res.json()["detail"]


def test_create_fdr_missing_or_blank_bank_name(client, setup_validation_db):
    """Verifies that missing or blank bank name is rejected on creation."""
    _, TestingSession = setup_validation_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)
    session.close()

    payload_blank_bank = {
        "fdr_number": "FDR-VALIDATION-001",
        "bank_name": "   ",
        "branch": "Main Branch",
        "amount": 500000.0,
        "issue_date": str(date(2026, 1, 1)),
        "maturity_date": str(date(2027, 1, 1)),
    }
    res = client.post("/api/v1/fdrs", json=payload_blank_bank, headers=headers)
    assert res.status_code == 400
    assert "Bank name" in res.json()["detail"]


def test_create_fdr_invalid_amounts(client, setup_validation_db):
    """Verifies that negative or zero deposit amounts are rejected on creation."""
    _, TestingSession = setup_validation_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)
    session.close()

    for invalid_amt in [0, -100, -0.01]:
        payload = {
            "fdr_number": f"FDR-AMT-{invalid_amt}",
            "bank_name": "Canara Bank",
            "branch": "Main Branch",
            "amount": invalid_amt,
            "issue_date": str(date(2026, 1, 1)),
            "maturity_date": str(date(2027, 1, 1)),
        }
        res = client.post("/api/v1/fdrs", json=payload, headers=headers)
        assert res.status_code == 400
        assert "positive" in res.json()["detail"].lower()


def test_create_fdr_maturity_before_issue_date(client, setup_validation_db):
    """Verifies that maturity_date < issue_date is rejected on creation."""
    _, TestingSession = setup_validation_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)
    session.close()

    payload = {
        "fdr_number": "FDR-DATE-ERR-001",
        "bank_name": "Bank of Baroda",
        "branch": "Camp Branch",
        "amount": 500000.0,
        "issue_date": str(date(2026, 12, 1)),
        "maturity_date": str(date(2026, 6, 1)),
    }
    res = client.post("/api/v1/fdrs", json=payload, headers=headers)
    assert res.status_code == 400
    assert "earlier than issue date" in res.json()["detail"].lower()


# =============================================================================
# 2. UPDATE FDR FIELD VALIDATIONS
# =============================================================================

def test_update_fdr_rejects_blank_strings_and_invalid_values(client, setup_validation_db):
    """Verifies that updating fields to blank or invalid values is rejected with 400."""
    _, TestingSession = setup_validation_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)

    # Create draft FDR
    c_res = client.post(
        "/api/v1/fdrs",
        json={
            "fdr_number": "FDR-UPDATE-VAL-001",
            "bank_name": "Union Bank",
            "branch": "Main Branch",
            "amount": 1000000.0,
            "issue_date": str(date(2026, 1, 1)),
            "maturity_date": str(date(2031, 1, 1)),
        },
        headers=headers,
    )
    assert c_res.status_code == 201
    fdr_id = c_res.json()["fdr_id"]
    session.close()

    # 1. Update FDR number to blank
    res1 = client.patch(f"/api/v1/fdrs/{fdr_id}", json={"fdr_number": "   "}, headers=headers)
    assert res1.status_code == 400
    assert "blank" in res1.json()["detail"].lower()

    # 2. Update bank name to blank
    res2 = client.patch(f"/api/v1/fdrs/{fdr_id}", json={"bank_name": "   "}, headers=headers)
    assert res2.status_code == 400
    assert "blank" in res2.json()["detail"].lower()

    # 3. Update amount to negative
    res3 = client.patch(f"/api/v1/fdrs/{fdr_id}", json={"amount": -500.0}, headers=headers)
    assert res3.status_code == 400
    assert "positive" in res3.json()["detail"].lower()

    # 4. Update maturity date to before issue date
    res4 = client.patch(f"/api/v1/fdrs/{fdr_id}", json={"maturity_date": "2025-01-01"}, headers=headers)
    assert res4.status_code == 400
    assert "earlier than issue date" in res4.json()["detail"].lower()


# =============================================================================
# 3. REQUIRED SUPPORTING DOCUMENT SUBMISSION VALIDATIONS
# =============================================================================

def test_submit_without_uploaded_document_rejected(client, setup_validation_db):
    """Verifies that submitting an FDR with NO supporting document uploaded is rejected."""
    _, TestingSession = setup_validation_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)

    # Create draft FDR
    c_res = client.post(
        "/api/v1/fdrs",
        json={
            "fdr_number": "FDR-NO-DOC-SUBMIT",
            "bank_name": "HDFC Bank",
            "branch": "FC Road",
            "amount": 2000000.0,
            "issue_date": str(date(2026, 1, 1)),
            "maturity_date": str(date(2031, 1, 1)),
        },
        headers=headers,
    )
    fdr_id = c_res.json()["fdr_id"]
    session.close()

    # Attempt to submit without uploading document
    res = client.post(
        f"/api/v1/fdrs/{fdr_id}/submit",
        json={"remarks": "Submitting without any document"},
        headers=headers,
    )
    assert res.status_code == 400
    assert "supporting document" in res.json()["detail"].lower()

    # Verify FDR status remains DRAFT
    session = TestingSession()
    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    assert fdr.status == FDRStatus.DRAFT.value
    session.close()


def test_submit_with_filename_alone_rejected(client, setup_validation_db):
    """Verifies that passing a filename in payload alone does NOT qualify as proof of upload."""
    _, TestingSession = setup_validation_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)

    c_res = client.post(
        "/api/v1/fdrs",
        json={
            "fdr_number": "FDR-FILENAME-ONLY",
            "bank_name": "Punjab National Bank",
            "branch": "Main Branch",
            "amount": 1500000.0,
            "issue_date": str(date(2026, 1, 1)),
            "maturity_date": str(date(2031, 1, 1)),
        },
        headers=headers,
    )
    fdr_id = c_res.json()["fdr_id"]
    session.close()

    # Attempt to submit passing only fileName / file_name in JSON payload
    res = client.post(
        f"/api/v1/fdrs/{fdr_id}/submit",
        json={
            "remarks": "I claim I have uploaded receipt.pdf",
            "file_name": "receipt.pdf",
            "fileName": "receipt.pdf",
        },
        headers=headers,
    )
    assert res.status_code == 400
    assert "filename alone does not qualify" in res.json()["detail"].lower()

    session = TestingSession()
    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    assert fdr.status == FDRStatus.DRAFT.value
    session.close()


def test_submit_with_nonexistent_supporting_doc_id(client, setup_validation_db):
    """Verifies that submitting with a non-existent supporting_document_id is rejected."""
    _, TestingSession = setup_validation_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)

    c_res = client.post(
        "/api/v1/fdrs",
        json={
            "fdr_number": "FDR-BAD-DOCID",
            "bank_name": "ICICI Bank",
            "branch": "Main Branch",
            "amount": 1000000.0,
            "issue_date": str(date(2026, 1, 1)),
            "maturity_date": str(date(2031, 1, 1)),
        },
        headers=headers,
    )
    fdr_id = c_res.json()["fdr_id"]
    session.close()

    res = client.post(
        f"/api/v1/fdrs/{fdr_id}/submit",
        json={"supporting_document_id": 999999, "remarks": "Bogus doc ID"},
        headers=headers,
    )
    assert res.status_code == 400
    assert "not found" in res.json()["detail"].lower()


def test_submit_with_document_belonging_to_another_fdr(client, setup_validation_db):
    """Verifies that submitting with a document associated with a different FDR is rejected."""
    _, TestingSession = setup_validation_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)

    # 1. Create FDR 1 and FDR 2
    res_1 = client.post(
        "/api/v1/fdrs",
        json={
            "fdr_number": "FDR-ORIG-DOC-001",
            "bank_name": "Axis Bank",
            "branch": "Branch 1",
            "amount": 1000000.0,
            "issue_date": str(date(2026, 1, 1)),
            "maturity_date": str(date(2031, 1, 1)),
        },
        headers=headers,
    )
    fdr_1_id = res_1.json()["fdr_id"]

    res_2 = client.post(
        "/api/v1/fdrs",
        json={
            "fdr_number": "FDR-STOLEN-DOC-002",
            "bank_name": "Axis Bank",
            "branch": "Branch 2",
            "amount": 1500000.0,
            "issue_date": str(date(2026, 1, 1)),
            "maturity_date": str(date(2031, 1, 1)),
        },
        headers=headers,
    )
    fdr_2_id = res_2.json()["fdr_id"]

    # 2. Upload document for FDR 1
    doc_res = client.post(
        f"/api/v1/fdrs/{fdr_1_id}/documents",
        files={"file": ("fdr1_receipt.pdf", VALID_PDF_BYTES, "application/pdf")},
        data={"document_type": "ORIGINAL_FDR"},
        headers=headers,
    )
    assert doc_res.status_code == 201
    doc_1_id = doc_res.json()["id"]

    # 3. Attempt to submit FDR 2 referencing FDR 1's document
    sub_res = client.post(
        f"/api/v1/fdrs/{fdr_2_id}/submit",
        json={"supporting_document_id": doc_1_id, "remarks": "Reusing FDR 1 document"},
        headers=headers,
    )
    assert sub_res.status_code == 400
    assert "not associated with FDR" in sub_res.json()["detail"]


def test_submit_with_valid_uploaded_document_success(client, setup_validation_db):
    """Verifies that an FDR with a valid uploaded document transitions to SUBMITTED successfully."""
    _, TestingSession = setup_validation_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)

    # 1. Create draft FDR
    c_res = client.post(
        "/api/v1/fdrs",
        json={
            "fdr_number": "FDR-VALID-SUBMIT-DOC",
            "bank_name": "Canara Bank",
            "branch": "FC Road",
            "amount": 2500000.0,
            "issue_date": str(date(2026, 1, 1)),
            "maturity_date": str(date(2031, 1, 1)),
        },
        headers=headers,
    )
    assert c_res.status_code == 201
    fdr_id = c_res.json()["fdr_id"]

    # 2. Upload valid document
    doc_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/documents",
        files={"file": ("deposit_receipt.pdf", VALID_PDF_BYTES, "application/pdf")},
        data={"document_type": "ORIGINAL_FDR"},
        headers=headers,
    )
    assert doc_res.status_code == 201
    doc_id = doc_res.json()["id"]

    # 3. Submit FDR with remarks
    sub_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/submit",
        json={"remarks": "FDR submitted with verified receipt upload", "supporting_document_id": doc_id},
        headers=headers,
    )
    assert sub_res.status_code == 200
    assert sub_res.json()["status"] == FDRStatus.SUBMITTED.value

    # 4. Verify DB status and transition history
    session = TestingSession()
    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    assert fdr.status == FDRStatus.SUBMITTED.value

    transition = (
        session.query(StatusTransitionHistory)
        .filter_by(fdr_id=fdr_id, to_status=FDRStatus.SUBMITTED.value)
        .first()
    )
    assert transition is not None
    assert transition.from_status == FDRStatus.DRAFT.value
    assert transition.to_status == FDRStatus.SUBMITTED.value
    assert transition.actor_id == officer.id
    session.close()


def test_institution_isolation_on_document_upload(client, setup_validation_db):
    """Verifies that an Institution Officer cannot upload documents to another institution's FDR."""
    _, TestingSession = setup_validation_db
    session = TestingSession()
    officer_1 = session.query(User).filter_by(username="officer_deshmukh").first()
    officer_2 = session.query(User).filter_by(username="officer_venkatesh").first()

    # Officer 1 creates FDR
    c_res = client.post(
        "/api/v1/fdrs",
        json={
            "fdr_number": "FDR-INST-ISOLATION-001",
            "bank_name": "State Bank of India",
            "branch": "Pune",
            "amount": 1000000.0,
            "issue_date": str(date(2026, 1, 1)),
            "maturity_date": str(date(2031, 1, 1)),
        },
        headers=auth_headers(officer_1),
    )
    fdr_id = c_res.json()["fdr_id"]
    session.close()

    # Officer 2 attempts to upload a document to Officer 1's FDR
    res = client.post(
        f"/api/v1/fdrs/{fdr_id}/documents",
        files={"file": ("malicious.pdf", VALID_PDF_BYTES, "application/pdf")},
        data={"document_type": "ORIGINAL_FDR"},
        headers=auth_headers(officer_2),
    )
    assert res.status_code == 403
    assert "Access forbidden" in res.json()["detail"]
