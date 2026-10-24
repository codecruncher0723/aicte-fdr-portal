"""
Dedicated Resource-Level Authorization & IDOR Prevention Tests.
Verifies Phase 3, Task 5 in PROJECT_PLAN.md:
- Resource-level checks prevent Insecure Direct Object References (IDOR).
- Guessed / nonexistent IDs across FDRs, requests, documents, notifications, and institutions return 404 without leakage.
- Institution Officers cannot access or modify another institution's resources by changing URL IDs, query parameters, or payload IDs.
- Role checks and ownership checks are applied across detail reads, updates, downloads, submissions, verification, and approvals.
- Appropriate 401, 403, 404, and 409 status codes are returned consistently.
"""

import io
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
from app.models.fdr import FDR, FieldProvenance
from app.models.document import DocumentVersion
from app.models.notification import Notification
from app.models.workflow import WorkflowRequest
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token
from app.main import app

VALID_PDF_BYTES = b"%PDF-1.4\n1 0 obj<</Title (IDOR Audit)>>endobj\n%%EOF"


@pytest.fixture(scope="module")
def setup_idor_db():
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

    # Seed extra test fixtures: a notification for Inst B and a workflow request for Inst B
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()
    officer_b = session.query(User).filter_by(username="officer_venkatesh").first()
    fdr_b = session.query(FDR).filter_by(institution_id=inst_b.id).first()

    # Create a document for FDR B if not already present
    doc_b = session.query(DocumentVersion).filter_by(fdr_id=fdr_b.id).first()
    if not doc_b:
        doc_b = DocumentVersion(
            fdr_id=fdr_b.id,
            version=1,
            document_type="FDR_RECEIPT",
            file_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            file_size_bytes=1024,
            mime_type="application/pdf",
            storage_key="documents/inst_b_doc1.pdf",
            original_filename="inst_b_receipt.pdf",
            uploaded_by_id=officer_b.id,
        )
        session.add(doc_b)

    # Create notification for Inst B
    notif_b = Notification(
        recipient_user_id=officer_b.id,
        institution_id=inst_b.id,
        title="Institution B Notice",
        message="Confidential notice for BMSCE.",
        notification_type="SYSTEM",
        is_read=False,
    )
    session.add(notif_b)

    # Create workflow request for FDR B
    wf_req_b = WorkflowRequest(
        fdr_id=fdr_b.id,
        request_type=RequestType.RENEWAL.value,
        status=RenewalStatus.REQUESTED.value,
        reason="Scheduled 5-year renewal",
        created_by_id=officer_b.id,
    )
    session.add(wf_req_b)
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
def client(setup_idor_db):
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
# 1. Nonexistent / Guessed Resource IDs (404 Not Found)
# -----------------------------------------------------------------------------

@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/v1/fdrs/999999"),
        ("patch", "/api/v1/fdrs/999999"),
        ("post", "/api/v1/fdrs/999999/submit"),
        ("post", "/api/v1/fdrs/999999/start-verification"),
        ("post", "/api/v1/fdrs/999999/verify"),
        ("post", "/api/v1/fdrs/999999/approval"),
        ("get", "/api/v1/fdrs/999999/audit-logs"),
        ("get", "/api/v1/fdrs/999999/documents"),
        ("post", "/api/v1/fdrs/999999/documents"),
        ("get", "/api/v1/documents/999999"),
        ("get", "/api/v1/documents/999999/download"),
        ("patch", "/api/v1/notifications/999999"),
        ("get", "/api/v1/institutions/999999"),
        ("get", "/api/v1/requests/999999"),
    ],
)
def test_nonexistent_resource_id_returns_404(client, setup_idor_db, method, path):
    """Verifies that guessing an invalid resource ID on any endpoint returns 404 without disclosure."""
    _, TestingSession = setup_idor_db
    session = TestingSession()
    admin = session.query(User).filter_by(role=UserRole.AICTE_ADMIN.value).first()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    verifier = session.query(User).filter_by(username="verif_malhotra").first()
    approver = session.query(User).filter_by(username="approver_kumar").first()

    # Use caller appropriate to the route's role requirements
    if path.endswith("/submit") or (method == "patch" and "/fdrs/" in path):
        token = token_for(officer_a)
    elif path.endswith("/verify") or path.endswith("/start-verification"):
        token = token_for(verifier)
    elif path.endswith("/approval"):
        token = token_for(approver)
    else:
        token = token_for(admin)

    headers = {"Authorization": f"Bearer {token}"}
    if method == "get":
        res = client.get(path, headers=headers)
    elif method == "patch":
        res = client.patch(path, headers=headers, json={"is_read": True, "notes": "test"})
    elif method == "post":
        if "documents" in path:
            res = client.post(
                path,
                headers=headers,
                files={"file": ("test.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
                data={"document_type": "FDR_RECEIPT"},
            )
        else:
            res = client.post(path, headers=headers, json={"decision": "VERIFIED", "remarks": "testing"})
    session.close()

    assert res.status_code == 404, f"Expected 404 for {method.upper()} {path}, got {res.status_code}: {res.text}"


# -----------------------------------------------------------------------------
# 2. Cross-Institution IDOR Attempts by Institution Officer (403 Forbidden)
# -----------------------------------------------------------------------------

def test_idor_cross_institution_fdr_detail(client, setup_idor_db):
    """Officer A attempting GET /api/v1/fdrs/{fdr_b.id} is blocked with 403."""
    _, TestingSession = setup_idor_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()
    fdr_b = session.query(FDR).filter_by(institution_id=inst_b.id).first()

    res = client.get(f"/api/v1/fdrs/{fdr_b.id}", headers={"Authorization": f"Bearer {token_for(officer_a)}"})
    assert res.status_code == 403
    session.close()


def test_idor_cross_institution_fdr_patch(client, setup_idor_db):
    """Officer A attempting PATCH /api/v1/fdrs/{fdr_b.id} is blocked with 403."""
    _, TestingSession = setup_idor_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()
    fdr_b = session.query(FDR).filter_by(institution_id=inst_b.id).first()

    res = client.patch(
        f"/api/v1/fdrs/{fdr_b.id}",
        headers={"Authorization": f"Bearer {token_for(officer_a)}"},
        json={"notes": "Malicious edit attempt by Officer A"},
    )
    assert res.status_code == 403
    session.close()


def test_idor_cross_institution_fdr_submit(client, setup_idor_db):
    """Officer A attempting POST /api/v1/fdrs/{fdr_b.id}/submit is blocked with 403."""
    _, TestingSession = setup_idor_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()
    fdr_b = session.query(FDR).filter_by(institution_id=inst_b.id).first()

    res = client.post(
        f"/api/v1/fdrs/{fdr_b.id}/submit",
        headers={"Authorization": f"Bearer {token_for(officer_a)}"},
        json={"remarks": "Malicious submit attempt"},
    )
    assert res.status_code == 403
    session.close()


def test_idor_cross_institution_fdr_audit_logs(client, setup_idor_db):
    """Officer A attempting GET /api/v1/fdrs/{fdr_b.id}/audit-logs is blocked with 403."""
    _, TestingSession = setup_idor_db
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


def test_idor_cross_institution_documents(client, setup_idor_db):
    """Officer A attempting document operations on Inst B resources is blocked with 403."""
    _, TestingSession = setup_idor_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()
    fdr_b = session.query(FDR).filter_by(institution_id=inst_b.id).first()
    doc_b = session.query(DocumentVersion).filter_by(fdr_id=fdr_b.id).first()
    token = token_for(officer_a)

    # 1. List Inst B documents
    assert client.get(f"/api/v1/fdrs/{fdr_b.id}/documents", headers={"Authorization": f"Bearer {token}"}).status_code == 403

    # 2. View Inst B document metadata
    assert client.get(f"/api/v1/documents/{doc_b.id}", headers={"Authorization": f"Bearer {token}"}).status_code == 403

    # 3. Download Inst B document
    assert client.get(f"/api/v1/documents/{doc_b.id}/download", headers={"Authorization": f"Bearer {token}"}).status_code == 403

    # 4. Upload to Inst B's FDR
    res_upload = client.post(
        f"/api/v1/fdrs/{fdr_b.id}/documents",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("malicious.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        data={"document_type": "FDR_RECEIPT"},
    )
    assert res_upload.status_code == 403
    session.close()


def test_idor_cross_institution_institution_detail(client, setup_idor_db):
    """Officer A attempting GET /api/v1/institutions/{inst_b.id} is blocked with 403."""
    _, TestingSession = setup_idor_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()

    res = client.get(
        f"/api/v1/institutions/{inst_b.id}",
        headers={"Authorization": f"Bearer {token_for(officer_a)}"},
    )
    assert res.status_code == 403
    session.close()


def test_idor_cross_institution_notification_patch(client, setup_idor_db):
    """Officer A attempting to patch a notification belonging to Inst B is blocked with 403."""
    _, TestingSession = setup_idor_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()
    notif_b = session.query(Notification).filter_by(institution_id=inst_b.id).first()

    res = client.patch(
        f"/api/v1/notifications/{notif_b.id}",
        headers={"Authorization": f"Bearer {token_for(officer_a)}"},
        json={"is_read": True},
    )
    assert res.status_code == 403
    session.close()


def test_idor_cross_institution_workflow_request(client, setup_idor_db):
    """Officer A attempting GET /api/v1/requests/{request_b.id} is blocked with 403."""
    _, TestingSession = setup_idor_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()
    fdr_b = session.query(FDR).filter_by(institution_id=inst_b.id).first()
    wf_b = session.query(WorkflowRequest).filter_by(fdr_id=fdr_b.id).first()

    res = client.get(
        f"/api/v1/requests/{wf_b.id}",
        headers={"Authorization": f"Bearer {token_for(officer_a)}"},
    )
    assert res.status_code == 403
    session.close()


# -----------------------------------------------------------------------------
# 3. Payload and Query Parameter ID Tampering
# -----------------------------------------------------------------------------

def test_payload_tampering_ignored_in_fdr_update(client, setup_idor_db):
    """
    Officer A calls PATCH /api/v1/fdrs/{fdr_a.id} with forged institution_id and created_by_id in body.
    The update succeeds on permitted fields, but the forged identity fields are safely ignored.
    """
    _, TestingSession = setup_idor_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()

    # Create a draft FDR for Inst A
    fdr_a = FDR(
        institution_id=officer_a.institution_id,
        fdr_number="FDR-IDOR-UPDATE-001",
        bank_name="Test Bank",
        branch="Test",
        ifsc="TEST0001",
        amount=500000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2027, 1, 1),
        status=FDRStatus.DRAFT.value,
        created_by_id=officer_a.id,
    )
    session.add(fdr_a)
    session.commit()

    # Attempt to tamper with institution_id and created_by in patch payload
    patch_payload = {
        "notes": "Updated notes safely",
        "institution_id": inst_b.id,  # Tampering
        "created_by_id": 9999,        # Tampering
    }
    res = client.patch(
        f"/api/v1/fdrs/{fdr_a.id}",
        headers={"Authorization": f"Bearer {token_for(officer_a)}"},
        json=patch_payload,
    )
    assert res.status_code == 200

    # Verify database record maintains genuine owner and institution
    session.refresh(fdr_a)
    assert fdr_a.notes == "Updated notes safely"
    assert fdr_a.institution_id == officer_a.institution_id
    assert fdr_a.institution_id != inst_b.id
    assert fdr_a.created_by_id == officer_a.id
    session.close()


# -----------------------------------------------------------------------------
# 4. Status Restrictions on FDR Updates
# -----------------------------------------------------------------------------

def test_fdr_patch_fails_for_non_editable_status(client, setup_idor_db):
    """An FDR that is SUBMITTED or ACTIVE cannot be modified via PATCH (returns 409 Conflict)."""
    _, TestingSession = setup_idor_db
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_a = session.query(Institution).filter_by(id=officer_a.institution_id).first()
    active_fdr = session.query(FDR).filter_by(institution_id=inst_a.id, status=FDRStatus.ACTIVE.value).first()

    assert active_fdr is not None

    res = client.patch(
        f"/api/v1/fdrs/{active_fdr.id}",
        headers={"Authorization": f"Bearer {token_for(officer_a)}"},
        json={"amount": 999999.0},
    )
    assert res.status_code == 409
    assert "cannot edit" in res.json()["detail"].lower()
    session.close()


# -----------------------------------------------------------------------------
# 5. Regulatory Oversight Roles Access (Explicit Cross-Institution Clearance)
# -----------------------------------------------------------------------------

def test_regulatory_roles_can_read_cross_institution_resources(client, setup_idor_db):
    """
    Verifies that AICTE_ADMIN, VERIFICATION_OFFICER, and APPROVING_AUTHORITY
    have authorized regulatory read access to FDRs and document metadata across institutions.
    """
    _, TestingSession = setup_idor_db
    session = TestingSession()
    admin = session.query(User).filter_by(role=UserRole.AICTE_ADMIN.value).first()
    verifier = session.query(User).filter_by(role=UserRole.VERIFICATION_OFFICER.value).first()
    approver = session.query(User).filter_by(role=UserRole.APPROVING_AUTHORITY.value).first()
    inst_b = session.query(Institution).filter_by(aicte_pid="1-88492011").first()
    fdr_b = session.query(FDR).filter_by(institution_id=inst_b.id).first()
    doc_b = session.query(DocumentVersion).filter_by(fdr_id=fdr_b.id).first()

    for role_user in [admin, verifier, approver]:
        token = token_for(role_user)
        # FDR detail read
        res_fdr = client.get(f"/api/v1/fdrs/{fdr_b.id}", headers={"Authorization": f"Bearer {token}"})
        assert res_fdr.status_code == 200, f"Role {role_user.role} failed to read FDR {fdr_b.id}"

        # Document metadata read
        res_doc = client.get(f"/api/v1/documents/{doc_b.id}", headers={"Authorization": f"Bearer {token}"})
        assert res_doc.status_code == 200, f"Role {role_user.role} failed to read document {doc_b.id}"

    # Admin institution detail read
    res_inst = client.get(f"/api/v1/institutions/{inst_b.id}", headers={"Authorization": f"Bearer {token_for(admin)}"})
    assert res_inst.status_code == 200
    session.close()
