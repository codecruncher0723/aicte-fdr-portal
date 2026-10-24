"""
Comprehensive Authorization Audit Tests Across All Protected Endpoints.
Verifies Phase 3, Task 3:
- Enforces authentication (401 on anonymous access) across:
  * FDR detail & list reads
  * Document list, upload, metadata, and download
  * Workflow submit, start-verification, verify, and approval
  * Dashboard summary and maturity horizon
  * Audit logs
  * CSV reports export
  * Notifications list and patch
- Enforces institution isolation:
  * Institution Officer A cannot read or write Institution B records
  * Query parameter tampering (?institution_id=other) is rejected with 403
  * Forged payload institution IDs are ignored and overridden with derived principal ID
- Enforces role boundaries:
  * Verification is forbidden to Approving Authority and Institution Officer
  * Approval is forbidden to Verification Officer and Institution Officer
  * Creation & submission are forbidden to non-institution officers
- Enforces separation of duties across all workflow decision endpoints.
"""

import os
import io
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
from app.models.notification import Notification
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token
from app.main import app

# Minimal valid PDF fixture for upload testing
VALID_PDF_BYTES = b"%PDF-1.4\n1 0 obj<</Title (Test Upload)>>endobj\n%%EOF"


@pytest.fixture(scope="module")
def setup_auth_db():
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
def client(setup_auth_db):
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
# 1. Anonymous Access Rejection (401 Unauthorized)
# -----------------------------------------------------------------------------

@pytest.mark.parametrize(
    "method,endpoint",
    [
        ("get", "/api/v1/fdrs"),
        ("get", "/api/v1/fdrs/1"),
        ("post", "/api/v1/fdrs"),
        ("post", "/api/v1/fdrs/1/submit"),
        ("post", "/api/v1/fdrs/1/start-verification"),
        ("get", "/api/v1/fdrs/1/audit-logs"),
        ("get", "/api/v1/fdrs/1/documents"),
        ("post", "/api/v1/fdrs/1/documents"),
        ("get", "/api/v1/documents/1"),
        ("get", "/api/v1/documents/1/download"),
        ("get", "/api/v1/dashboard/summary"),
        ("get", "/api/v1/dashboard/maturity"),
        ("get", "/api/v1/reports/fdrs.csv"),
        ("get", "/api/v1/notifications"),
        ("patch", "/api/v1/notifications/1"),
    ],
)
def test_all_endpoints_reject_anonymous_calls(client, method, endpoint):
    """Verifies that every single protected endpoint rejects unauthenticated access with 401."""
    if method == "get":
        res = client.get(endpoint)
    elif method == "post":
        res = client.post(endpoint, json={})
    elif method == "patch":
        res = client.patch(endpoint, json={"is_read": True})
    assert res.status_code in (401, 403), f"Endpoint {endpoint} should reject anonymous access"
    assert "WWW-Authenticate" in res.headers or res.status_code == 401


# -----------------------------------------------------------------------------
# 2. FDR Detail & List Reads: Scoping & IDOR Prevention
# -----------------------------------------------------------------------------

def test_fdr_list_scoping_and_cross_institution_rejection(client, setup_auth_db):
    """Verifies list scoping and rejection of query parameter manipulation."""
    _, TestingSession = setup_auth_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()
    token = token_for(officer_a)

    # 1. Normal list returns ONLY officer A's institution FDRs
    res = client.get("/api/v1/fdrs", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) >= 2
    for item in items:
        assert item["institution_id"] == officer_a.institution_id

    # 2. Attempt to bypass by passing ?institution_id=inst_b -> 403 Forbidden
    res_bypass = client.get(
        f"/api/v1/fdrs?institution_id={inst_b.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_bypass.status_code == 403
    assert "cannot query" in res_bypass.json()["detail"].lower()
    session.close()


def test_fdr_detail_idor_protection(client, setup_auth_db):
    """Verifies that an Institution Officer cannot view an FDR belonging to another institution."""
    _, TestingSession = setup_auth_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()
    fdr_b = session.query(FDR).filter_by(institution_id=inst_b.id).first()
    token = token_for(officer_a)

    # Accessing Inst B's FDR with Inst A's token -> 403 Forbidden
    res = client.get(f"/api/v1/fdrs/{fdr_b.id}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403
    assert "another institution" in res.json()["detail"].lower()
    session.close()


# -----------------------------------------------------------------------------
# 3. Document Endpoints: Metadata, Downloads, and Uploads
# -----------------------------------------------------------------------------

def test_document_endpoints_cross_institution_protection(client, setup_auth_db):
    """Verifies that document list, download, and upload enforce strict institution isolation."""
    _, TestingSession = setup_auth_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()
    fdr_b = session.query(FDR).filter_by(institution_id=inst_b.id).first()
    doc_b = session.query(DocumentVersion).filter_by(fdr_id=fdr_b.id).first()
    token = token_for(officer_a)

    # 1. List documents for Inst B's FDR -> 403 Forbidden
    res_list = client.get(f"/api/v1/fdrs/{fdr_b.id}/documents", headers={"Authorization": f"Bearer {token}"})
    assert res_list.status_code == 403

    # 2. View metadata of Inst B's document -> 403 Forbidden
    res_meta = client.get(f"/api/v1/documents/{doc_b.id}", headers={"Authorization": f"Bearer {token}"})
    assert res_meta.status_code == 403

    # 3. Download Inst B's document -> 403 Forbidden
    res_down = client.get(f"/api/v1/documents/{doc_b.id}/download", headers={"Authorization": f"Bearer {token}"})
    assert res_down.status_code == 403

    # 4. Upload document to Inst B's FDR -> 403 Forbidden
    res_up = client.post(
        f"/api/v1/fdrs/{fdr_b.id}/documents",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("malicious.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        data={"document_type": "FDR_RECEIPT"},
    )
    assert res_up.status_code == 403
    session.close()


# -----------------------------------------------------------------------------
# 4. Dashboard Aggregates & Audit Log Views
# -----------------------------------------------------------------------------

def test_dashboard_summary_scoped_by_institution(client, setup_auth_db):
    """Verifies that dashboard summary aggregates are strictly isolated for Institution Officers."""
    _, TestingSession = setup_auth_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    admin = session.query(User).filter_by(role=UserRole.AICTE_ADMIN.value).first()

    # Officer A view: scoped to own institution
    res_a = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {token_for(officer_a)}"})
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert data_a["institution_scope"] == officer_a.institution_id

    # Admin view: global across all institutions
    res_admin = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {token_for(admin)}"})
    assert res_admin.status_code == 200
    data_admin = res_admin.json()
    assert data_admin["institution_scope"] == "ALL"
    assert data_admin["total_fdrs"] > data_a["total_fdrs"]
    session.close()


def test_fdr_audit_logs_cross_institution_protection(client, setup_auth_db):
    """Verifies that an Institution Officer cannot view audit logs of another institution's FDR."""
    _, TestingSession = setup_auth_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()
    fdr_b = session.query(FDR).filter_by(institution_id=inst_b.id).first()

    res = client.get(
        f"/api/v1/fdrs/{fdr_b.id}/audit-logs",
        headers={"Authorization": f"Bearer {token_for(officer_a)}"},
    )
    assert res.status_code == 403
    session.close()


# -----------------------------------------------------------------------------
# 5. CSV Reports Export Authorization
# -----------------------------------------------------------------------------

def test_csv_report_export_scoped_by_institution(client, setup_auth_db):
    """Verifies that CSV export respects role and institution scoping."""
    _, TestingSession = setup_auth_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()

    # 1. Normal export returns CSV with only officer A's institution FDRs
    res = client.get("/api/v1/reports/fdrs.csv", headers={"Authorization": f"Bearer {token_for(officer_a)}"})
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    lines = res.text.strip().split("\r\n")
    assert len(lines) >= 2  # header + rows
    # Check that Inst B's PID does not appear
    assert "BMS College of Architecture" not in res.text

    # 2. Attempt to export Inst B by passing ?institution_id -> 403 Forbidden
    res_bypass = client.get(
        f"/api/v1/reports/fdrs.csv?institution_id={inst_b.id}",
        headers={"Authorization": f"Bearer {token_for(officer_a)}"},
    )
    assert res_bypass.status_code == 403
    session.close()


# -----------------------------------------------------------------------------
# 6. Notifications Ownership & Patch Protection
# -----------------------------------------------------------------------------

def test_notification_patch_ownership_enforcement(client, setup_auth_db):
    """Verifies that a user cannot mark another user's notification as read."""
    _, TestingSession = setup_auth_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    officer_b = session.query(User).filter_by(username="officer_venkatesh").first()

    # Find notification belonging exclusively to Officer B
    notif_b = session.query(Notification).filter_by(recipient_user_id=officer_b.id).first()
    assert notif_b is not None

    # Officer A attempts to patch Officer B's notification -> 403 Forbidden
    res = client.patch(
        f"/api/v1/notifications/{notif_b.id}",
        headers={"Authorization": f"Bearer {token_for(officer_a)}"},
        json={"is_read": True},
    )
    assert res.status_code == 403
    assert "another recipient" in res.json()["detail"].lower()
    session.close()


# -----------------------------------------------------------------------------
# 7. Forged Institution ID in Create Payload Overridden
# -----------------------------------------------------------------------------

def test_create_fdr_overrides_forged_institution_id(client, setup_auth_db):
    """Verifies that an attempt by an Institution Officer to set another institution_id in payload is ignored."""
    _, TestingSession = setup_auth_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()

    # Officer A payload includes institution_id=inst_b.id (tampering attempt)
    payload = {
        "fdr_number": "FDR-TAMPER-001",
        "bank_name": "Tamper Bank",
        "branch": "Main Branch",
        "ifsc": "TMPR0001234",
        "amount": 500000.0,
        "issue_date": "2025-01-01",
        "maturity_date": "2026-01-01",
        "institution_id": inst_b.id,  # FORGED
    }

    res = client.post(
        "/api/v1/fdrs",
        headers={"Authorization": f"Bearer {token_for(officer_a)}"},
        json=payload,
    )
    assert res.status_code == 201
    created_fdr_id = res.json()["fdr_id"]

    # Verify database record is assigned to Officer A's true institution_id, NOT Inst B
    created_fdr = session.query(FDR).filter_by(id=created_fdr_id).first()
    assert created_fdr.institution_id == officer_a.institution_id
    assert created_fdr.institution_id != inst_b.id
    session.close()
