"""
Focused Document Management & Forensic Audit History Integration Tests.
Verifies:
1. Document upload with file validation (valid PDF/image, rejected oversized/unsupported).
2. Document versioning, listing, and SHA-256 metadata persistence.
3. Authenticated streaming downloads with Content-Disposition headers and cross-institution authorization blocking.
4. FDR-scoped audit history loading with actor attribution, actions, and timestamps.
5. System-wide audit log listing with server-side role/institution scoping.
6. Tamper-evident audit log CSV export.
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
from app.models.enums import UserRole, FDRStatus
from app.models.institution import Institution
from app.models.user import User
from app.models.fdr import FDR
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token
from app.main import app

VALID_PDF_BYTES = b"%PDF-1.4\n1 0 obj<</Title (Doc Audit Test)>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"
VALID_PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"


@pytest.fixture(scope="module")
def setup_doc_audit_db():
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
def client(setup_doc_audit_db):
    return TestClient(app)


def token_for(user: User) -> str:
    return create_access_token({
        "sub": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "institution_id": user.institution_id,
    })


def test_document_upload_and_versioning_lifecycle(client, setup_doc_audit_db):
    """
    Tests uploading multiple document versions, metadata retrieval, and authenticated download.
    """
    _, TestingSession = setup_doc_audit_db
    db = TestingSession()

    inst1_user = db.query(User).filter_by(username="officer_deshmukh").first()
    inst2_user = db.query(User).filter_by(username="officer_venkatesh").first()
    admin_user = db.query(User).filter_by(username="admin_sridhar").first()

    inst1_token = token_for(inst1_user)
    inst2_token = token_for(inst2_user)
    admin_token = token_for(admin_user)

    # 1. Create FDR for Inst 1
    create_res = client.post(
        "/api/v1/fdrs",
        json={
            "fdr_number": "FDR-DOC-AUDIT-101",
            "bank_name": "Punjab National Bank",
            "branch": "Camp Pune",
            "ifsc": "PUNB0012900",
            "amount": 1000000.0,
            "issue_date": str(date(2026, 1, 1)),
            "maturity_date": str(date(2031, 1, 1)),
        },
        headers={"Authorization": f"Bearer {inst1_token}"},
    )
    assert create_res.status_code == 201
    fdr_id = create_res.json()["id"]

    # 2. Upload Version 1 (PDF)
    v1_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/documents",
        files={"file": ("fdr_initial.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        data={"document_type": "FDR_RECEIPT"},
        headers={"Authorization": f"Bearer {inst1_token}"},
    )
    assert v1_res.status_code == 201
    v1_doc = v1_res.json()
    assert v1_doc["version"] == 1
    assert "sha256_hash" in v1_doc
    assert "storage_key" not in v1_doc  # Never leaks raw storage paths
    doc1_id = v1_doc["id"]

    # 3. Upload Version 2 (PNG replacement/corrected version)
    v2_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/documents",
        files={"file": ("fdr_signed_endorsement.png", io.BytesIO(VALID_PNG_BYTES), "image/png")},
        data={"document_type": "FDR_RECEIPT"},
        headers={"Authorization": f"Bearer {inst1_token}"},
    )
    assert v2_res.status_code == 201
    v2_doc = v2_res.json()
    assert v2_doc["version"] == 2
    doc2_id = v2_doc["id"]

    # 4. List FDR document versions
    list_res = client.get(
        f"/api/v1/fdrs/{fdr_id}/documents",
        headers={"Authorization": f"Bearer {inst1_token}"},
    )
    assert list_res.status_code == 200
    docs = list_res.json()
    assert len(docs) == 2
    assert docs[0]["version"] == 1
    assert docs[1]["version"] == 2

    # 5. Get individual document metadata
    meta_res = client.get(
        f"/api/v1/documents/{doc1_id}",
        headers={"Authorization": f"Bearer {inst1_token}"},
    )
    assert meta_res.status_code == 200
    assert meta_res.json()["file_name"] == "fdr_initial.pdf"

    # 6. Authenticated document download
    download_res = client.get(
        f"/api/v1/documents/{doc1_id}/download",
        headers={"Authorization": f"Bearer {inst1_token}"},
    )
    assert download_res.status_code == 200
    assert download_res.content == VALID_PDF_BYTES
    assert "attachment" in download_res.headers.get("Content-Disposition", "")

    # 7. Cross-institution download isolation (Officer from Inst 2 blocked)
    cross_down_res = client.get(
        f"/api/v1/documents/{doc1_id}/download",
        headers={"Authorization": f"Bearer {inst2_token}"},
    )
    assert cross_down_res.status_code == 403

    # 8. AICTE Admin can download cross-institution
    admin_down_res = client.get(
        f"/api/v1/documents/{doc1_id}/download",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_down_res.status_code == 200

    # 9. Negative upload: Oversized file rejected (> 10MB)
    huge_bytes = b"0" * (11 * 1024 * 1024)
    huge_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/documents",
        files={"file": ("huge.pdf", io.BytesIO(huge_bytes), "application/pdf")},
        data={"document_type": "FDR_RECEIPT"},
        headers={"Authorization": f"Bearer {inst1_token}"},
    )
    assert huge_res.status_code == 413

    # 10. Negative upload: Invalid file format (disguised text) rejected
    fake_pdf = b"Plain text not a real pdf"
    fake_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/documents",
        files={"file": ("fake.pdf", io.BytesIO(fake_pdf), "application/pdf")},
        data={"document_type": "FDR_RECEIPT"},
        headers={"Authorization": f"Bearer {inst1_token}"},
    )
    assert fake_res.status_code in (400, 415)

    db.close()


def test_fdr_and_global_audit_history_apis(client, setup_doc_audit_db):
    """
    Tests FDR-scoped and global audit log APIs, role scoping, and CSV export.
    """
    _, TestingSession = setup_doc_audit_db
    db = TestingSession()

    inst1_user = db.query(User).filter_by(username="officer_deshmukh").first()
    inst2_user = db.query(User).filter_by(username="officer_venkatesh").first()
    admin_user = db.query(User).filter_by(username="admin_sridhar").first()

    inst1_token = token_for(inst1_user)
    inst2_token = token_for(inst2_user)
    admin_token = token_for(admin_user)

    # 1. Create and submit an FDR to generate audit events
    create_res = client.post(
        "/api/v1/fdrs",
        json={
            "fdr_number": "FDR-AUDIT-TEST-202",
            "bank_name": "State Bank of India",
            "branch": "FC Road",
            "ifsc": "SBIN0001290",
            "amount": 500000.0,
            "issue_date": str(date(2026, 2, 1)),
            "maturity_date": str(date(2031, 2, 1)),
        },
        headers={"Authorization": f"Bearer {inst1_token}"},
    )
    fdr_id = create_res.json()["id"]

    client.post(
        f"/api/v1/fdrs/{fdr_id}/documents",
        files={"file": ("receipt.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        data={"document_type": "FDR_RECEIPT"},
        headers={"Authorization": f"Bearer {inst1_token}"},
    )
    client.post(
        f"/api/v1/fdrs/{fdr_id}/submit",
        headers={"Authorization": f"Bearer {inst1_token}"},
    )

    # 2. FDR-scoped audit history
    fdr_audit_res = client.get(
        f"/api/v1/fdrs/{fdr_id}/audit-logs",
        headers={"Authorization": f"Bearer {inst1_token}"},
    )
    assert fdr_audit_res.status_code == 200
    logs = fdr_audit_res.json()
    assert len(logs) >= 1
    actions = [l["action"] for l in logs]
    assert "STATUS_TRANSITION_SUBMITTED" in actions

    # 3. Cross-institution FDR audit history is blocked for Inst 2
    cross_audit_res = client.get(
        f"/api/v1/fdrs/{fdr_id}/audit-logs",
        headers={"Authorization": f"Bearer {inst2_token}"},
    )
    assert cross_audit_res.status_code == 403

    # 4. Global audit logs for AICTE Admin
    admin_global_res = client.get(
        "/api/v1/audit-logs?limit=50",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_global_res.status_code == 200
    admin_logs = admin_global_res.json()
    assert len(admin_logs) > 0
    assert "hash" in admin_logs[0]

    # 5. Global audit logs for Institution Officer (scoped to their own institution/events)
    inst_global_res = client.get(
        "/api/v1/audit-logs?limit=50",
        headers={"Authorization": f"Bearer {inst1_token}"},
    )
    assert inst_global_res.status_code == 200
    inst_logs = inst_global_res.json()
    # All records must either be by inst1_user or targeting inst1's FDRs
    for l in inst_logs:
        if l["target_type"] == "FDR":
            target_fdr = db.query(FDR).filter_by(id=int(l["target_id"])).first()
            if target_fdr:
                assert target_fdr.institution_id == inst1_user.institution_id

    # 6. Global audit log CSV export
    csv_res = client.get(
        "/api/v1/audit-logs/export.csv",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers.get("Content-Type", "")
    assert "Log ID,Timestamp (UTC),Actor Name" in csv_res.text

    db.close()
