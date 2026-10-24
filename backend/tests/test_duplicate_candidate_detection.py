"""
Dedicated Comprehensive Test Suite for Configurable Duplicate FDR Candidate Detection.
Verifies Phase 4, Task 4 in PROJECT_PLAN.md:
- Deterministic, efficient, institution-aware candidate detection without assuming FDR numbers are globally unique.
- Flags candidates for review with DUPLICATE_FDR_CANDIDATE and REVIEW_REQUIRED severity.
- NEVER enforces a global database uniqueness constraint or rejects records.
- Matching vs non-matching records.
- Configurable uniqueness scopes:
    * INSTITUTION_AND_BANK_AND_NUMBER (Canonical default)
    * INSTITUTION_AND_NUMBER
    * CROSS_INSTITUTION_BANK_AND_NUMBER
    * EXACT_MATCH
    * GLOBAL_NUMBER
- Cross-institution cases and isolation.
- Prospective check endpoint (POST /api/v1/fdrs/check-duplicates).
- Resource-level IDOR and role authorization on GET /api/v1/fdrs/{fdr_id}/duplicate-candidates.
- Existing record compatibility and handling of REJECTED records.
"""

import os
import tempfile
import pytest
from datetime import date, timedelta
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import get_db
from app.models.enums import UserRole, FDRStatus, DiscrepancySeverity, DiscrepancyCode
from app.models.institution import Institution
from app.models.user import User
from app.models.fdr import FDR
from app.models.document import DocumentVersion
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token
from app.duplicate_detection import (
    find_duplicate_candidates,
    build_duplicate_discrepancy,
    resolve_scope,
    DuplicateScope,
)
from app.main import app


@pytest.fixture(scope="module")
def setup_test_db():
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
        try:
            db.rollback()
        except Exception:
            pass

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
def client(setup_test_db):
    _, _ = setup_test_db
    return TestClient(app)


def token_for(user: User) -> str:
    return create_access_token(
        data={
            "sub": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "institution_id": user.institution_id,
        }
    )


def auth_headers(user: User) -> dict:
    return {"Authorization": f"Bearer {token_for(user)}"}


def test_resolve_scope_and_aliases():
    """Verifies that scope resolution handles canonical names, aliases, and rejects invalid scopes."""
    assert resolve_scope(None) == DuplicateScope.INSTITUTION_AND_BANK_AND_NUMBER.value
    assert resolve_scope("") == DuplicateScope.INSTITUTION_AND_BANK_AND_NUMBER.value
    assert resolve_scope("INSTITUTION_AND_BANK_AND_NUMBER") == DuplicateScope.INSTITUTION_AND_BANK_AND_NUMBER.value
    assert resolve_scope("ISSUER_AND_NUMBER_AND_INSTITUTION") == DuplicateScope.INSTITUTION_AND_BANK_AND_NUMBER.value
    assert resolve_scope("institution_bank_number") == DuplicateScope.INSTITUTION_AND_BANK_AND_NUMBER.value
    assert resolve_scope("institution-and-number") == DuplicateScope.INSTITUTION_AND_NUMBER.value
    assert resolve_scope("CROSS_INSTITUTION_BANK_AND_NUMBER") == DuplicateScope.CROSS_INSTITUTION_BANK_AND_NUMBER.value
    assert resolve_scope("bank_and_number") == DuplicateScope.CROSS_INSTITUTION_BANK_AND_NUMBER.value
    assert resolve_scope("EXACT_MATCH") == DuplicateScope.EXACT_MATCH.value
    assert resolve_scope("exact") == DuplicateScope.EXACT_MATCH.value
    assert resolve_scope("GLOBAL_NUMBER") == DuplicateScope.GLOBAL_NUMBER.value
    assert resolve_scope("global") == DuplicateScope.GLOBAL_NUMBER.value

    with pytest.raises(ValueError) as exc:
        resolve_scope("COMPLETELY_INVALID_SCOPE")
    assert "Invalid duplicate detection scope" in str(exc.value)


def test_non_matching_record_returns_no_candidates(setup_test_db, client):
    """An FDR with distinct parameters returns zero candidates and no discrepancy flag."""
    _, TestingSession = setup_test_db
    db = TestingSession()
    officer = db.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)
    officer_inst_id = officer.institution_id
    officer_id = officer.id

    fdr = FDR(
        institution_id=officer_inst_id,
        fdr_number="FDR-UNIQUE-99999",
        bank_name="State Bank of India",
        branch="Powai",
        ifsc="SBIN0001234",
        amount=Decimal("500000.00"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2030, 1, 1),
        status=FDRStatus.DRAFT.value,
        created_by_id=officer_id,
    )
    db.add(fdr)
    db.commit()
    fdr_id = fdr.id
    db.close()

    resp = client.get(f"/api/v1/fdrs/{fdr_id}/duplicate-candidates", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["fdr_id"] == fdr_id
    assert data["has_candidates"] is False
    assert data["candidate_count"] == 0
    assert data["discrepancy"] is None
    assert data["candidates"] == []


def test_same_institution_same_bank_same_number_detected(setup_test_db, client):
    """
    Two FDRs in the same institution with the same bank and same FDR number
    are detected as duplicate candidates under default scope.
    """
    _, TestingSession = setup_test_db
    db = TestingSession()
    officer = db.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)
    officer_inst_id = officer.institution_id
    officer_id = officer.id

    # Existing FDR 1
    fdr1 = FDR(
        institution_id=officer_inst_id,
        fdr_number="FDR-PLEDGE-101",
        bank_name="Punjab National Bank",
        branch="Main Branch",
        ifsc="PUNB0001111",
        amount=Decimal("1000000.00"),
        issue_date=date(2024, 1, 10),
        maturity_date=date(2029, 1, 10),
        status=FDRStatus.ACTIVE.value,
        created_by_id=officer_id,
    )
    # Existing FDR 2 with same number, institution, and bank
    fdr2 = FDR(
        institution_id=officer_inst_id,
        fdr_number="FDR-PLEDGE-101",
        bank_name="Punjab National Bank",
        branch="Main Branch",
        ifsc="PUNB0001111",
        amount=Decimal("1000000.00"),
        issue_date=date(2024, 1, 10),
        maturity_date=date(2029, 1, 10),
        status=FDRStatus.DRAFT.value,
        created_by_id=officer_id,
    )
    db.add_all([fdr1, fdr2])
    db.commit()
    fdr1_id, fdr2_id = fdr1.id, fdr2.id
    db.close()

    # Query duplicate candidates for FDR 2
    resp = client.get(f"/api/v1/fdrs/{fdr2_id}/duplicate-candidates", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_candidates"] is True
    assert data["candidate_count"] >= 1
    assert data["discrepancy"] is not None
    assert data["discrepancy"]["code"] == DiscrepancyCode.DUPLICATE_FDR_CANDIDATE.value
    assert data["discrepancy"]["severity"] == DiscrepancySeverity.REVIEW_REQUIRED.value
    assert fdr1_id in data["discrepancy"]["candidate_ids"]

    # Verify self is excluded
    cand_ids = [c["id"] for c in data["candidates"]]
    assert fdr2_id not in cand_ids
    assert fdr1_id in cand_ids


def test_different_bank_same_institution_scope_behavior(setup_test_db, client):
    """
    FDRs with same number and same institution but DIFFERENT banks:
    - NOT flagged under INSTITUTION_AND_BANK_AND_NUMBER
    - FLAGGED under INSTITUTION_AND_NUMBER
    """
    _, TestingSession = setup_test_db
    db = TestingSession()
    officer = db.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)
    officer_inst_id = officer.institution_id
    officer_id = officer.id

    fdr_canara = FDR(
        institution_id=officer_inst_id,
        fdr_number="FDR-DIFF-BANK-001",
        bank_name="Canara Bank",
        branch="Branch A",
        ifsc="CNRB0001234",
        amount=Decimal("750000.00"),
        issue_date=date(2024, 5, 1),
        maturity_date=date(2029, 5, 1),
        status=FDRStatus.ACTIVE.value,
        created_by_id=officer_id,
    )
    fdr_sbi = FDR(
        institution_id=officer_inst_id,
        fdr_number="FDR-DIFF-BANK-001",
        bank_name="State Bank of India",
        branch="Branch B",
        ifsc="SBIN0009999",
        amount=Decimal("750000.00"),
        issue_date=date(2024, 5, 1),
        maturity_date=date(2029, 5, 1),
        status=FDRStatus.DRAFT.value,
        created_by_id=officer_id,
    )
    db.add_all([fdr_canara, fdr_sbi])
    db.commit()
    fdr_sbi_id = fdr_sbi.id
    fdr_canara_id = fdr_canara.id
    db.close()

    # 1. Under default scope (INSTITUTION_AND_BANK_AND_NUMBER): different bank -> no candidate
    resp_default = client.get(
        f"/api/v1/fdrs/{fdr_sbi_id}/duplicate-candidates",
        params={"scope": "INSTITUTION_AND_BANK_AND_NUMBER"},
        headers=headers,
    )
    assert resp_default.status_code == 200
    assert resp_default.json()["has_candidates"] is False

    # 2. Under INSTITUTION_AND_NUMBER scope: bank is ignored -> candidate found
    resp_scope2 = client.get(
        f"/api/v1/fdrs/{fdr_sbi_id}/duplicate-candidates",
        params={"scope": "INSTITUTION_AND_NUMBER"},
        headers=headers,
    )
    assert resp_scope2.status_code == 200
    data_scope2 = resp_scope2.json()
    assert data_scope2["has_candidates"] is True
    assert fdr_canara_id in [c["id"] for c in data_scope2["candidates"]]


def test_cross_institution_candidate_detection(setup_test_db, client):
    """
    Cross-institution cases:
    - Same number and bank in different institutions is NOT flagged under INSTITUTION_AND_BANK_AND_NUMBER.
    - IS flagged under CROSS_INSTITUTION_BANK_AND_NUMBER with is_cross_institution=True.
    """
    _, TestingSession = setup_test_db
    db = TestingSession()
    officer1 = db.query(User).filter_by(username="officer_deshmukh").first()
    officer2 = db.query(User).filter_by(username="officer_venkatesh").first()
    verifier = db.query(User).filter_by(username="verif_malhotra").first()
    v_headers = auth_headers(verifier)
    inst1_id = officer1.institution_id
    inst2_id = officer2.institution_id
    officer1_id = officer1.id
    officer2_id = officer2.id

    fdr_inst1 = FDR(
        institution_id=inst1_id,
        fdr_number="FDR-CROSS-INST-777",
        bank_name="Bank of Baroda",
        branch="Shivaji Nagar",
        ifsc="BARB0001234",
        amount=Decimal("500000.00"),
        issue_date=date(2024, 2, 1),
        maturity_date=date(2029, 2, 1),
        status=FDRStatus.ACTIVE.value,
        created_by_id=officer1_id,
    )
    fdr_inst2 = FDR(
        institution_id=inst2_id,
        fdr_number="FDR-CROSS-INST-777",
        bank_name="Bank of Baroda",
        branch="FC Road",
        ifsc="BARB0001234",
        amount=Decimal("500000.00"),
        issue_date=date(2024, 2, 1),
        maturity_date=date(2029, 2, 1),
        status=FDRStatus.SUBMITTED.value,
        created_by_id=officer2_id,
    )
    db.add_all([fdr_inst1, fdr_inst2])
    db.commit()
    fdr_inst2_id = fdr_inst2.id
    fdr_inst1_id = fdr_inst1.id
    db.close()

    # 1. Under default scope: cross-institution is isolated
    resp_def = client.get(
        f"/api/v1/fdrs/{fdr_inst2_id}/duplicate-candidates",
        params={"scope": "INSTITUTION_AND_BANK_AND_NUMBER"},
        headers=v_headers,
    )
    assert resp_def.status_code == 200
    assert resp_def.json()["has_candidates"] is False

    # 2. Under CROSS_INSTITUTION_BANK_AND_NUMBER: detected
    resp_cross = client.get(
        f"/api/v1/fdrs/{fdr_inst2_id}/duplicate-candidates",
        params={"scope": "CROSS_INSTITUTION_BANK_AND_NUMBER"},
        headers=v_headers,
    )
    assert resp_cross.status_code == 200
    data_cross = resp_cross.json()
    assert data_cross["has_candidates"] is True
    cand = data_cross["candidates"][0]
    assert cand["id"] == fdr_inst1_id
    assert cand["is_cross_institution"] is True
    assert cand["institution_id"] == inst1_id


def test_exact_match_scope(setup_test_db, client):
    """
    EXACT_MATCH scope requires institution, bank, number, amount, and issue date to match.
    """
    _, TestingSession = setup_test_db
    db = TestingSession()
    officer = db.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)
    officer_inst_id = officer.institution_id
    officer_id = officer.id

    fdr_base = FDR(
        institution_id=officer_inst_id,
        fdr_number="FDR-EXACT-SPEC",
        bank_name="Axis Bank",
        branch="Main",
        ifsc="UTIB0000001",
        amount=Decimal("300000.00"),
        issue_date=date(2024, 3, 1),
        maturity_date=date(2029, 3, 1),
        status=FDRStatus.ACTIVE.value,
        created_by_id=officer_id,
    )
    # Differing amount
    fdr_diff_amount = FDR(
        institution_id=officer_inst_id,
        fdr_number="FDR-EXACT-SPEC",
        bank_name="Axis Bank",
        branch="Main",
        ifsc="UTIB0000001",
        amount=Decimal("350000.00"),  # Different amount
        issue_date=date(2024, 3, 1),
        maturity_date=date(2029, 3, 1),
        status=FDRStatus.DRAFT.value,
        created_by_id=officer_id,
    )
    # Exact duplicate
    fdr_identical = FDR(
        institution_id=officer_inst_id,
        fdr_number="FDR-EXACT-SPEC",
        bank_name="Axis Bank",
        branch="Main",
        ifsc="UTIB0000001",
        amount=Decimal("300000.00"),
        issue_date=date(2024, 3, 1),
        maturity_date=date(2029, 3, 1),
        status=FDRStatus.DRAFT.value,
        created_by_id=officer_id,
    )
    db.add_all([fdr_base, fdr_diff_amount, fdr_identical])
    db.commit()
    fdr_diff_id = fdr_diff_amount.id
    fdr_ident_id = fdr_identical.id
    fdr_base_id = fdr_base.id
    db.close()

    # Checking fdr_diff_amount under EXACT_MATCH: no candidate (amount differed)
    resp_diff = client.get(
        f"/api/v1/fdrs/{fdr_diff_id}/duplicate-candidates",
        params={"scope": "EXACT_MATCH"},
        headers=headers,
    )
    assert resp_diff.status_code == 200
    assert resp_diff.json()["has_candidates"] is False

    # Checking fdr_identical under EXACT_MATCH: fdr_base matches
    resp_ident = client.get(
        f"/api/v1/fdrs/{fdr_ident_id}/duplicate-candidates",
        params={"scope": "EXACT_MATCH"},
        headers=headers,
    )
    assert resp_ident.status_code == 200
    data_ident = resp_ident.json()
    assert data_ident["has_candidates"] is True
    assert fdr_base_id in [c["id"] for c in data_ident["candidates"]]


def test_duplicate_candidate_does_not_reject_fdr_creation_or_submission(setup_test_db, client):
    """
    CRITICAL INVARIANT: Duplicate detection flags candidates for review but
    MUST NOT reject FDR creation, editing, or submission.
    No global uniqueness constraint is enforced.
    """
    _, TestingSession = setup_test_db
    db = TestingSession()
    officer = db.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)
    officer_inst_id = officer.institution_id
    officer_id = officer.id

    # Existing active FDR with number FDR-NONBLOCK-001
    existing_fdr = FDR(
        institution_id=officer_inst_id,
        fdr_number="FDR-NONBLOCK-001",
        bank_name="Union Bank of India",
        branch="Powai",
        ifsc="UBIN0001234",
        amount=Decimal("400000.00"),
        issue_date=date(2024, 6, 1),
        maturity_date=date(2029, 6, 1),
        status=FDRStatus.ACTIVE.value,
        created_by_id=officer_id,
    )
    db.add(existing_fdr)
    db.commit()
    db.close()

    # 1. Create a second FDR with the EXACT same FDR number and bank
    create_payload = {
        "fdr_number": "FDR-NONBLOCK-001",
        "bank_name": "Union Bank of India",
        "branch": "Powai",
        "ifsc": "UBIN0001234",
        "amount": 400000.00,
        "issue_date": "2024-06-01",
        "maturity_date": "2029-06-01",
    }
    resp_create = client.post("/api/v1/fdrs", json=create_payload, headers=headers)
    assert resp_create.status_code == 201  # Successfully created as DRAFT, NOT rejected!
    new_fdr_id = resp_create.json()["id"]

    # 2. Attach a valid supporting document
    db = TestingSession()
    doc = DocumentVersion(
        fdr_id=new_fdr_id,
        document_type="FDR_RECEIPT",
        file_name="receipt.pdf",
        storage_key="test/receipt.pdf",
        file_size=2048,
        mime_type="application/pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        uploaded_by_id=officer_id,
    )
    db.add(doc)
    db.commit()
    db.close()

    # 3. Submit the FDR: must succeed without being blocked by duplicate candidate
    resp_submit = client.post(
        f"/api/v1/fdrs/{new_fdr_id}/submit",
        json={"remarks": "Submitting valid FDR despite candidate match."},
        headers=headers,
    )
    assert resp_submit.status_code == 200
    assert resp_submit.json()["status"] == FDRStatus.SUBMITTED.value

    # 4. Check duplicate candidates endpoint returns review flag
    resp_check = client.get(f"/api/v1/fdrs/{new_fdr_id}/duplicate-candidates", headers=headers)
    assert resp_check.status_code == 200
    data_check = resp_check.json()
    assert data_check["has_candidates"] is True
    assert data_check["discrepancy"]["severity"] == DiscrepancySeverity.REVIEW_REQUIRED.value
    assert data_check["discrepancy"]["code"] == DiscrepancyCode.DUPLICATE_FDR_CANDIDATE.value


def test_prospective_check_endpoint(setup_test_db, client):
    """
    POST /api/v1/fdrs/check-duplicates allows pre-flight candidate evaluation
    before creating or saving an FDR record.
    """
    _, TestingSession = setup_test_db
    db = TestingSession()
    officer = db.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)
    db.close()

    # Pre-flight check with existing number
    payload = {
        "fdr_number": "FDR-NONBLOCK-001",
        "bank_name": "Union Bank of India",
        "amount": 400000.0,
        "issue_date": "2024-06-01",
    }
    resp = client.post("/api/v1/fdrs/check-duplicates", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_candidates"] is True
    assert data["candidate_count"] >= 1
    assert data["discrepancy"]["code"] == "DUPLICATE_FDR_CANDIDATE"


def test_invalid_scope_returns_400(setup_test_db, client):
    """Passing an unknown duplicate detection scope returns HTTP 400."""
    _, TestingSession = setup_test_db
    db = TestingSession()
    officer = db.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)
    fdr = db.query(FDR).filter_by(institution_id=officer.institution_id).first()
    fdr_id = fdr.id
    db.close()

    resp = client.get(
        f"/api/v1/fdrs/{fdr_id}/duplicate-candidates",
        params={"scope": "NON_EXISTENT_SCOPE"},
        headers=headers,
    )
    assert resp.status_code == 400
    assert "Invalid duplicate detection scope" in resp.json()["detail"]


def test_authorization_and_idor_protection(setup_test_db, client):
    """
    Enforces server-side authentication and IDOR protection:
    - Unauthenticated -> 401
    - Nonexistent FDR -> 404
    - Cross-institution read by Institution Officer -> 403
    - Regulatory roles (Admin, Verifier, Approver) -> 200 across institutions
    """
    _, TestingSession = setup_test_db
    db = TestingSession()
    officer1 = db.query(User).filter_by(username="officer_deshmukh").first()
    officer2 = db.query(User).filter_by(username="officer_venkatesh").first()
    verifier = db.query(User).filter_by(username="verif_malhotra").first()
    admin = db.query(User).filter_by(username="admin_sridhar").first()

    iitb_headers = auth_headers(officer1)
    verifier_headers = auth_headers(verifier)
    admin_headers = auth_headers(admin)

    fdr_inst2 = db.query(FDR).filter_by(institution_id=officer2.institution_id).first()
    fdr_inst2_id = fdr_inst2.id
    db.close()

    # 1. Unauthenticated request
    resp_anon = client.get(f"/api/v1/fdrs/{fdr_inst2_id}/duplicate-candidates")
    assert resp_anon.status_code == 401

    # 2. Nonexistent resource
    resp_404 = client.get("/api/v1/fdrs/999999/duplicate-candidates", headers=verifier_headers)
    assert resp_404.status_code == 404

    # 3. IDOR: Officer 1 querying Officer 2's institution FDR
    resp_idor = client.get(f"/api/v1/fdrs/{fdr_inst2_id}/duplicate-candidates", headers=iitb_headers)
    assert resp_idor.status_code == 403

    # 4. Verifier can query cross-institution FDR
    resp_ver = client.get(f"/api/v1/fdrs/{fdr_inst2_id}/duplicate-candidates", headers=verifier_headers)
    assert resp_ver.status_code == 200

    # 5. Admin can query cross-institution FDR
    resp_adm = client.get(f"/api/v1/fdrs/{fdr_inst2_id}/duplicate-candidates", headers=admin_headers)
    assert resp_adm.status_code == 200


def test_rejected_records_handling(setup_test_db, client):
    """
    REJECTED records are excluded from duplicate candidates by default,
    preventing legitimate re-submissions after a formal rejection from being flagged.
    Can be included if include_rejected=True.
    """
    _, TestingSession = setup_test_db
    db = TestingSession()
    officer = db.query(User).filter_by(username="officer_deshmukh").first()
    headers = auth_headers(officer)
    officer_inst_id = officer.institution_id
    officer_id = officer.id

    fdr_rejected = FDR(
        institution_id=officer_inst_id,
        fdr_number="FDR-RESUBMIT-555",
        bank_name="Kotak Mahindra Bank",
        branch="Bandra",
        ifsc="KKBK0001234",
        amount=Decimal("200000.00"),
        issue_date=date(2024, 8, 1),
        maturity_date=date(2029, 8, 1),
        status=FDRStatus.REJECTED.value,
        created_by_id=officer_id,
    )
    fdr_new = FDR(
        institution_id=officer_inst_id,
        fdr_number="FDR-RESUBMIT-555",
        bank_name="Kotak Mahindra Bank",
        branch="Bandra",
        ifsc="KKBK0001234",
        amount=Decimal("200000.00"),
        issue_date=date(2024, 8, 1),
        maturity_date=date(2029, 8, 1),
        status=FDRStatus.DRAFT.value,
        created_by_id=officer_id,
    )
    db.add_all([fdr_rejected, fdr_new])
    db.commit()
    fdr_new_id = fdr_new.id
    fdr_rej_id = fdr_rejected.id
    db.close()

    # Default: excluded
    resp_default = client.get(f"/api/v1/fdrs/{fdr_new_id}/duplicate-candidates", headers=headers)
    assert resp_default.status_code == 200
    assert resp_default.json()["has_candidates"] is False

    # Include rejected
    resp_inc = client.get(
        f"/api/v1/fdrs/{fdr_new_id}/duplicate-candidates",
        params={"include_rejected": "true"},
        headers=headers,
    )
    assert resp_inc.status_code == 200
    assert resp_inc.json()["has_candidates"] is True
    assert fdr_rej_id in [c["id"] for c in resp_inc.json()["candidates"]]
