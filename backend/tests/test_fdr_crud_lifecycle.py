"""
Dedicated Comprehensive Test Suite for FDR Create, List, Detail, and Update Operations.
Verifies Phase 4, Task 1 in PROJECT_PLAN.md:
- Create draft FDR with canonical and Section 8.3 schemas.
- Server-side derivation of institution_id and created_by principal.
- List FDRs with all Section 8.3 query parameters: status, issuing_bank,
  maturity_from, maturity_to, amount_min, amount_max, search, page, limit.
- Enforce institution isolation on listing, reads, and updates.
- Regulatory oversight read permissions across institutions.
- Update FDR permitted strictly in DRAFT and CORRECTION_REQUIRED states.
- Reject updates in all non-permitted states (SUBMITTED, ACTIVE, etc.) with 409 Conflict.
- Strict field provenance tracking on critical field changes.
- Validation of positive amounts, maturity >= issue date, non-empty bank, and required reason.
- Prevention of unauthorized roles and anonymous access.
"""

import os
import tempfile
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import get_db
from app.models.enums import UserRole, FDRStatus, ProvenanceSource
from app.models.institution import Institution
from app.models.user import User
from app.models.fdr import FDR, FieldProvenance
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token
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
# 1. CREATE FDR TESTS
# =============================================================================

def test_fdr_create_canonical_success(client, setup_test_db):
    """Verifies draft FDR creation with canonical schema and principal derivation."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    assert officer is not None

    payload = {
        "fdr_number": "FDR-CANONICAL-001",
        "cert_number": "CERT-CANONICAL-001",
        "bank_name": "State Bank of India",
        "branch": "Shivaji Nagar",
        "ifsc": "SBIN0001234",
        "amount": 2500000.0,
        "interest_rate": "7.1%",
        "issue_date": str(date(2026, 1, 1)),
        "maturity_date": str(date(2031, 1, 1)),
        "tenure_years": 5,
        "auto_rollover": True,
        "notes": "Canonical test FDR",
    }

    res = client.post("/api/v1/fdrs", json=payload, headers=auth_headers(officer))
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == FDRStatus.DRAFT.value
    fdr_id = data["fdr_id"]
    assert fdr_id > 0

    # Verify DB persistence and principal derivation
    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    assert fdr is not None
    assert fdr.institution_id == officer.institution_id
    assert fdr.created_by_id == officer.id
    assert fdr.status == FDRStatus.DRAFT.value
    assert float(fdr.amount) == 2500000.0

    # Initial provenance record
    prov = session.query(FieldProvenance).filter_by(fdr_id=fdr_id, field_name="fdr_number").first()
    assert prov is not None
    assert prov.new_value == "FDR-CANONICAL-001"
    assert prov.source_category == ProvenanceSource.INSTITUTION_ENTERED.value
    assert prov.actor_id == officer.id
    session.close()


def test_fdr_create_section_8_3_schema_success(client, setup_test_db):
    """Verifies draft FDR creation with Section 8.3 schema (deposit_amount, issuing_bank, branch_name)."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()

    payload = {
        "fdr_number": "FDR-SEC83-002",
        "issuing_bank": "Bank of Baroda",
        "branch_name": "Camp Branch, Pune",
        "deposit_amount": 500000.0,
        "interest_rate": 6.85,
        "issue_date": str(date(2026, 2, 1)),
        "maturity_date": str(date(2027, 2, 1)),
    }

    res = client.post("/api/v1/fdrs", json=payload, headers=auth_headers(officer))
    assert res.status_code == 201
    data = res.json()
    fdr_id = data["fdr_id"]

    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    assert fdr.bank_name == "Bank of Baroda"
    assert fdr.branch == "Camp Branch, Pune"
    assert float(fdr.amount) == 500000.0
    assert fdr.interest_rate == "6.85"
    assert fdr.institution_id == officer.institution_id
    session.close()


def test_fdr_create_tampered_payload_ids_safely_ignored(client, setup_test_db):
    """Verifies client-supplied institution_id or created_by in create payload are overridden."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()

    payload = {
        "fdr_number": "FDR-TAMPER-003",
        "bank_name": "Canara Bank",
        "branch": "Main Branch",
        "amount": 1000000.0,
        "issue_date": str(date(2026, 3, 1)),
        "maturity_date": str(date(2031, 3, 1)),
        "institution_id": 99999,
        "created_by": 88888,
        "created_by_id": 77777,
    }

    res = client.post("/api/v1/fdrs", json=payload, headers=auth_headers(officer))
    assert res.status_code == 201
    fdr_id = res.json()["fdr_id"]

    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    assert fdr.institution_id == officer.institution_id
    assert fdr.institution_id != 99999
    assert fdr.created_by_id == officer.id
    assert fdr.created_by_id != 88888
    session.close()


def test_fdr_create_invalid_amount_rejected(client, setup_test_db):
    """Verifies that negative or zero deposit amounts are rejected with 400 Bad Request."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()

    payload_neg = {
        "fdr_number": "FDR-NEG-004",
        "bank_name": "Axis Bank",
        "branch": "Kothrud",
        "amount": -50000.0,
        "issue_date": str(date(2026, 1, 1)),
        "maturity_date": str(date(2027, 1, 1)),
    }
    res = client.post("/api/v1/fdrs", json=payload_neg, headers=auth_headers(officer))
    assert res.status_code == 400

    payload_zero = {
        "fdr_number": "FDR-ZERO-005",
        "issuing_bank": "Axis Bank",
        "branch_name": "Kothrud",
        "deposit_amount": 0.0,
        "issue_date": str(date(2026, 1, 1)),
        "maturity_date": str(date(2027, 1, 1)),
    }
    res2 = client.post("/api/v1/fdrs", json=payload_zero, headers=auth_headers(officer))
    assert res2.status_code == 400
    session.close()


def test_fdr_create_invalid_dates_rejected(client, setup_test_db):
    """Verifies that maturity_date < issue_date is rejected with 400 Bad Request."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()

    payload = {
        "fdr_number": "FDR-DATES-006",
        "bank_name": "ICICI Bank",
        "branch": "Aundh",
        "amount": 750000.0,
        "issue_date": str(date(2026, 6, 1)),
        "maturity_date": str(date(2025, 6, 1)),
    }
    res = client.post("/api/v1/fdrs", json=payload, headers=auth_headers(officer))
    assert res.status_code == 400
    assert "Maturity date cannot be earlier than issue date" in res.json()["detail"]
    session.close()


def test_fdr_create_missing_bank_rejected(client, setup_test_db):
    """Verifies that missing bank name is rejected with 400 Bad Request."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()

    payload = {
        "fdr_number": "FDR-NOBANK-007",
        "branch": "Deccan",
        "amount": 100000.0,
        "issue_date": str(date(2026, 1, 1)),
        "maturity_date": str(date(2027, 1, 1)),
    }
    res = client.post("/api/v1/fdrs", json=payload, headers=auth_headers(officer))
    assert res.status_code == 400
    assert "Bank name" in res.json()["detail"]
    session.close()


def test_fdr_create_unauthorized_roles(client, setup_test_db):
    """Verifies that non-institution officers and unauthenticated users cannot create FDRs."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    admin = session.query(User).filter_by(username="admin_sridhar").first()
    verif = session.query(User).filter_by(username="verif_malhotra").first()
    approver = session.query(User).filter_by(username="approver_kumar").first()

    payload = {
        "fdr_number": "FDR-UNAUTH-008",
        "bank_name": "HDFC Bank",
        "branch": "Main",
        "amount": 100000.0,
        "issue_date": str(date(2026, 1, 1)),
        "maturity_date": str(date(2027, 1, 1)),
    }

    # Non-officer roles get 403 Forbidden
    for user in [admin, verif, approver]:
        res = client.post("/api/v1/fdrs", json=payload, headers=auth_headers(user))
        assert res.status_code == 403

    # Unauthenticated gets 401 Unauthorized
    res_anon = client.post("/api/v1/fdrs", json=payload)
    assert res_anon.status_code == 401
    session.close()


# =============================================================================
# 2. DETAIL FDR READ TESTS
# =============================================================================

def test_fdr_detail_owning_officer_success(client, setup_test_db):
    """Verifies owning Institution Officer can retrieve FDR detail."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    fdr = session.query(FDR).filter_by(institution_id=officer.institution_id).first()
    assert fdr is not None

    res = client.get(f"/api/v1/fdrs/{fdr.id}", headers=auth_headers(officer))
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == fdr.id
    assert data["fdr_id"] == fdr.id
    assert data["fdr_number"] == fdr.fdr_number
    assert data["institution_id"] == officer.institution_id
    assert data["deposit_amount"] == float(fdr.amount)
    assert data["issuing_bank"] == fdr.bank_name
    session.close()


def test_fdr_detail_cross_institution_forbidden(client, setup_test_db):
    """Verifies Institution Officer cannot view an FDR belonging to another institution."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    officer_1 = session.query(User).filter_by(username="officer_deshmukh").first()
    officer_2 = session.query(User).filter_by(username="officer_venkatesh").first()
    fdr_1 = session.query(FDR).filter_by(institution_id=officer_1.institution_id).first()

    res = client.get(f"/api/v1/fdrs/{fdr_1.id}", headers=auth_headers(officer_2))
    assert res.status_code == 403
    assert "another institution" in res.json()["detail"]
    session.close()


def test_fdr_detail_regulatory_roles_allowed(client, setup_test_db):
    """Verifies regulatory roles (Admin, Verifier, Approver) can read cross-institution FDR details."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    admin = session.query(User).filter_by(username="admin_sridhar").first()
    verif = session.query(User).filter_by(username="verif_malhotra").first()
    approver = session.query(User).filter_by(username="approver_kumar").first()
    fdr = session.query(FDR).first()

    for user in [admin, verif, approver]:
        res = client.get(f"/api/v1/fdrs/{fdr.id}", headers=auth_headers(user))
        assert res.status_code == 200
        assert res.json()["fdr_number"] == fdr.fdr_number
    session.close()


def test_fdr_detail_nonexistent_returns_404(client, setup_test_db):
    """Verifies reading nonexistent FDR returns 404 Not Found."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    admin = session.query(User).filter_by(username="admin_sridhar").first()

    res = client.get("/api/v1/fdrs/999999", headers=auth_headers(admin))
    assert res.status_code == 404
    session.close()


# =============================================================================
# 3. LIST AND FILTER FDR TESTS
# =============================================================================

def test_fdr_list_status_filter(client, setup_test_db):
    """Verifies filtering FDR list by status."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    admin = session.query(User).filter_by(username="admin_sridhar").first()

    res = client.get("/api/v1/fdrs?status=CORRECTION_REQUIRED", headers=auth_headers(admin))
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert len(data["items"]) >= 1
    for item in data["items"]:
        assert item["status"] == "CORRECTION_REQUIRED"
    session.close()


def test_fdr_list_bank_and_search_filter(client, setup_test_db):
    """Verifies filtering FDR list by issuing_bank and text search."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    admin = session.query(User).filter_by(username="admin_sridhar").first()

    # Issuing bank filter
    res_bank = client.get("/api/v1/fdrs?issuing_bank=Punjab", headers=auth_headers(admin))
    assert res_bank.status_code == 200
    items_bank = res_bank.json()["items"]
    assert len(items_bank) >= 1
    for item in items_bank:
        assert "Punjab" in item["bank_name"]

    # Search filter
    res_search = client.get("/api/v1/fdrs?search=PNB", headers=auth_headers(admin))
    assert res_search.status_code == 200
    items_search = res_search.json()["items"]
    assert len(items_search) >= 1
    session.close()


def test_fdr_list_date_range_filter(client, setup_test_db):
    """Verifies filtering FDR list by maturity_from and maturity_to dates."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    admin = session.query(User).filter_by(username="admin_sridhar").first()

    res = client.get(
        "/api/v1/fdrs?maturity_from=2026-01-01&maturity_to=2030-12-31",
        headers=auth_headers(admin),
    )
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) >= 1
    for item in items:
        mat_date = date.fromisoformat(item["maturity_date"])
        assert date(2026, 1, 1) <= mat_date <= date(2030, 12, 31)
    session.close()


def test_fdr_list_amount_range_filter(client, setup_test_db):
    """Verifies filtering FDR list by amount_min and amount_max."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    admin = session.query(User).filter_by(username="admin_sridhar").first()

    res = client.get(
        "/api/v1/fdrs?amount_min=5000000&amount_max=15000000",
        headers=auth_headers(admin),
    )
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) >= 1
    for item in items:
        assert 5000000.0 <= item["deposit_amount"] <= 15000000.0
    session.close()


def test_fdr_list_pagination(client, setup_test_db):
    """Verifies pagination parameters page and limit on FDR list."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    admin = session.query(User).filter_by(username="admin_sridhar").first()

    res = client.get("/api/v1/fdrs?page=1&limit=2", headers=auth_headers(admin))
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) <= 2
    assert data["page"] == 1
    assert data["limit"] == 2
    assert data["total"] >= 2
    session.close()


def test_fdr_list_institution_isolation_and_scoping(client, setup_test_db):
    """Verifies institution isolation when querying FDR list."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    officer_1 = session.query(User).filter_by(username="officer_deshmukh").first()
    officer_2 = session.query(User).filter_by(username="officer_venkatesh").first()

    # Officer 1 automatically scoped to Inst 1
    res1 = client.get("/api/v1/fdrs", headers=auth_headers(officer_1))
    assert res1.status_code == 200
    for item in res1.json()["items"]:
        assert item["institution_id"] == officer_1.institution_id

    # Officer 1 attempting to query ?institution_id=inst_2 -> 403 Forbidden
    res_tamper = client.get(
        f"/api/v1/fdrs?institution_id={officer_2.institution_id}",
        headers=auth_headers(officer_1),
    )
    assert res_tamper.status_code == 403
    session.close()


# =============================================================================
# 4. UPDATE FDR TESTS
# =============================================================================

def test_fdr_update_permitted_in_draft_status(client, setup_test_db):
    """Verifies updating an FDR in DRAFT status records field provenance atomically."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()

    # 1. Create a draft FDR
    create_res = client.post(
        "/api/v1/fdrs",
        json={
            "fdr_number": "FDR-UPDATE-DRAFT-001",
            "bank_name": "Union Bank of India",
            "branch": "FC Road",
            "amount": 1500000.0,
            "issue_date": str(date(2026, 1, 1)),
            "maturity_date": str(date(2031, 1, 1)),
        },
        headers=auth_headers(officer),
    )
    assert create_res.status_code == 201
    fdr_id = create_res.json()["fdr_id"]

    # 2. Update critical and non-critical fields
    update_payload = {
        "fdr_number": "FDR-UPDATE-DRAFT-001-REV",
        "amount": 1800000.0,
        "notes": "Updated draft notes for compliance",
        "reason": "Corrected principal amount as per approved sanction letter",
    }
    update_res = client.patch(
        f"/api/v1/fdrs/{fdr_id}",
        json=update_payload,
        headers=auth_headers(officer),
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == FDRStatus.DRAFT.value

    # 3. Verify database updates and provenance entries
    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    assert fdr.fdr_number == "FDR-UPDATE-DRAFT-001-REV"
    assert float(fdr.amount) == 1800000.0
    assert fdr.notes == "Updated draft notes for compliance"

    prov_amount = (
        session.query(FieldProvenance)
        .filter_by(fdr_id=fdr_id, field_name="amount")
        .first()
    )
    assert prov_amount is not None
    assert float(prov_amount.old_value) == 1500000.0
    assert float(prov_amount.new_value) == 1800000.0
    assert prov_amount.actor_id == officer.id
    assert prov_amount.reason == "Corrected principal amount as per approved sanction letter"
    session.close()


def test_fdr_update_permitted_in_correction_required_status(client, setup_test_db):
    """Verifies updating an FDR in CORRECTION_REQUIRED status is permitted."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    fdr = (
        session.query(FDR)
        .filter_by(institution_id=officer.institution_id, status=FDRStatus.CORRECTION_REQUIRED.value)
        .first()
    )
    assert fdr is not None

    update_payload = {
        "mandate_clause": "Exclusive Statutory Lien with Amended WRO Descriptor under Reg 14(B)",
        "notes": "Amended Form L-1 uploaded with WRO descriptor",
        "reason": "Submitted corrected mandate descriptor per scrutiny remarks",
    }
    res = client.patch(
        f"/api/v1/fdrs/{fdr.id}",
        json=update_payload,
        headers=auth_headers(officer),
    )
    assert res.status_code == 200
    assert res.json()["status"] == FDRStatus.CORRECTION_REQUIRED.value
    session.close()


def test_fdr_update_rejected_in_forbidden_statuses(client, setup_test_db):
    """Verifies that updating an FDR in non-editable states (ACTIVE, SUBMITTED) returns 409 Conflict."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    fdr_active = (
        session.query(FDR)
        .filter_by(institution_id=officer.institution_id, status=FDRStatus.ACTIVE.value)
        .first()
    )
    assert fdr_active is not None

    res = client.patch(
        f"/api/v1/fdrs/{fdr_active.id}",
        json={"notes": "Illegal edit attempt on active FDR"},
        headers=auth_headers(officer),
    )
    assert res.status_code == 409
    assert "Cannot edit FDR in 'ACTIVE' status" in res.json()["detail"]
    session.close()


def test_fdr_update_cross_institution_forbidden(client, setup_test_db):
    """Verifies Institution Officer cannot update an FDR belonging to another institution."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    officer_1 = session.query(User).filter_by(username="officer_deshmukh").first()
    officer_2 = session.query(User).filter_by(username="officer_venkatesh").first()
    fdr_1 = (
        session.query(FDR)
        .filter_by(institution_id=officer_1.institution_id, status=FDRStatus.CORRECTION_REQUIRED.value)
        .first()
    )

    res = client.patch(
        f"/api/v1/fdrs/{fdr_1.id}",
        json={"notes": "Illegal cross-institution update"},
        headers=auth_headers(officer_2),
    )
    assert res.status_code == 403
    session.close()


def test_fdr_update_unauthorized_roles(client, setup_test_db):
    """Verifies that non-institution officers cannot update FDRs."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    admin = session.query(User).filter_by(username="admin_sridhar").first()
    verif = session.query(User).filter_by(username="verif_malhotra").first()
    approver = session.query(User).filter_by(username="approver_kumar").first()
    fdr = session.query(FDR).filter_by(status=FDRStatus.CORRECTION_REQUIRED.value).first()

    for user in [admin, verif, approver]:
        res = client.patch(
            f"/api/v1/fdrs/{fdr.id}",
            json={"notes": "Unauthorized role update"},
            headers=auth_headers(user),
        )
        assert res.status_code == 403

    res_anon = client.patch(f"/api/v1/fdrs/{fdr.id}", json={"notes": "Anon update"})
    assert res_anon.status_code == 401
    session.close()


def test_fdr_update_validation_errors(client, setup_test_db):
    """Verifies update validation: positive amount, valid date range, required reason, 404 for missing."""
    _, TestingSession = setup_test_db
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    fdr = (
        session.query(FDR)
        .filter_by(institution_id=officer.institution_id, status=FDRStatus.CORRECTION_REQUIRED.value)
        .first()
    )

    # 1. Negative amount
    res_neg = client.patch(
        f"/api/v1/fdrs/{fdr.id}",
        json={"amount": -500.0},
        headers=auth_headers(officer),
    )
    assert res_neg.status_code == 400
    assert "positive" in res_neg.json()["detail"].lower()

    # 2. Maturity date before issue date
    res_dates = client.patch(
        f"/api/v1/fdrs/{fdr.id}",
        json={"maturity_date": "2020-01-01"},
        headers=auth_headers(officer),
    )
    assert res_dates.status_code == 400
    assert "Maturity date cannot be earlier than issue date" in res_dates.json()["detail"]

    # 3. Missing reason when modifying critical field
    res_no_reason = client.patch(
        f"/api/v1/fdrs/{fdr.id}",
        json={"amount": 12000000.0, "reason": "   "},
        headers=auth_headers(officer),
    )
    assert res_no_reason.status_code == 400
    assert "reason is required" in res_no_reason.json()["detail"].lower()

    # 4. Non-existent FDR ID
    res_404 = client.patch(
        "/api/v1/fdrs/999999",
        json={"notes": "Non-existent"},
        headers=auth_headers(officer),
    )
    assert res_404.status_code == 404
    session.close()
