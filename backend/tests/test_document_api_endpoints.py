"""
Comprehensive HTTP Integration Test Suite for Document Security, Upload,
Metadata, Authenticated Download, IDOR Protection, Versioning, and Evidence Linking.

Verifies Phase 4, Tasks 5, 6, 7, and 8 in PROJECT_PLAN.md:
- Task 5: Private upload/storage for PDF, JPG/JPEG, PNG, WEBP; max 10 MB;
          validate extension, MIME and magic bytes; reject empty/corrupt/mismatched files;
          generate server-side names; block path traversal; calculate SHA-256.
- Task 6: Authenticated metadata list/detail/download endpoints with resource-level authorization.
          Never serve private files directly from the public web root.
- Task 7: Keep original filename as metadata only; avoid returning internal storage paths.
- Task 8: Preserve each prior submitted document version; link the version reviewed/approved
          to its workflow evidence where feasible.
"""

import os
import io
import hashlib
import tempfile
import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import config as app_config
from app import storage as app_storage
from app.database import get_db
from app.models.enums import UserRole, FDRStatus
from app.models.institution import Institution
from app.models.user import User
from app.models.fdr import FDR
from app.models.document import DocumentVersion
from app.models.workflow import VerificationRecord, ApprovalRecord, WorkflowRequest
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import create_access_token
from app.main import app

# Compact, valid binary test fixtures with authentic magic bytes
VALID_PDF = b"%PDF-1.5\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n%%EOF"
VALID_JPEG = bytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48]) + bytes([0xFF, 0xD9])
VALID_PNG = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]) + bytes([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00])
VALID_WEBP = b"RIFF" + bytes([0x14, 0x00, 0x00, 0x00]) + b"WEBPVP8 " + bytes([0x08, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00])


@pytest.fixture(scope="module")
def setup_doc_test_env():
    """Sets up an isolated SQLite DB and temporary private storage directory."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_db:
        db_path = tmp_db.name

    tmp_storage_dir = tempfile.mkdtemp(prefix="fdr_doc_storage_")
    orig_storage_config = app_config.STORAGE_DIR
    orig_storage_app = app_storage.STORAGE_DIR
    app_config.STORAGE_DIR = tmp_storage_dir
    app_storage.STORAGE_DIR = tmp_storage_dir

    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
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

    yield engine, TestingSession, tmp_storage_dir

    app.dependency_overrides.clear()
    app_config.STORAGE_DIR = orig_storage_config
    app_storage.STORAGE_DIR = orig_storage_app
    engine.dispose()
    try:
        if os.path.exists(db_path):
            os.remove(db_path)
    except Exception:
        pass


@pytest.fixture
def client(setup_doc_test_env):
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


# ============================================================================
# Task 5 & 7: Upload validation, formats, limits, traversal, SHA-256 & Metadata
# ============================================================================

def test_upload_all_valid_document_formats(client, setup_doc_test_env):
    """
    Verifies that all allowed formats (PDF, JPEG, PNG, WEBP) upload successfully,
    generate 201 Created, compute exact SHA-256, and return safe metadata.
    """
    _, TestingSession, _ = setup_doc_test_env
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    fdr_a = session.query(FDR).filter_by(institution_id=officer_a.institution_id).first()
    headers = auth_headers(officer_a)
    session.close()

    formats = [
        ("receipt.pdf", VALID_PDF, "application/pdf"),
        ("receipt.jpg", VALID_JPEG, "image/jpeg"),
        ("receipt.png", VALID_PNG, "image/png"),
        ("receipt.webp", VALID_WEBP, "image/webp"),
    ]

    for filename, content, mime in formats:
        expected_sha = hashlib.sha256(content).hexdigest()
        res = client.post(
            f"/api/v1/fdrs/{fdr_a.id}/documents",
            files={"file": (filename, content, mime)},
            data={"document_type": "ORIGINAL_FDR"},
            headers=headers,
        )
        assert res.status_code == 201, f"Failed for {filename}: {res.text}"
        data = res.json()

        # Section 8.4 schema compliance
        assert data["document_id"] > 0
        assert data["fdr_id"] == fdr_a.id
        assert data["file_name"] == filename
        assert data["sha256"] == expected_sha
        assert "uploaded_at" in data
        assert data["version"] >= 1

        # Security Invariant: NEVER leak internal storage paths or storage_key
        assert "storage_key" not in data
        assert "storage_path" not in data
        assert "local_path" not in data
        assert "\\" not in data["file_name"]
        assert "/" not in data["file_name"]


def test_file_size_limit_rejection_over_10mb(client, setup_doc_test_env):
    """Verifies that files exceeding 10 MB are rejected with 413 Request Entity Too Large."""
    _, TestingSession, _ = setup_doc_test_env
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    fdr = session.query(FDR).filter_by(institution_id=officer.institution_id).first()
    headers = auth_headers(officer)
    session.close()

    # Create oversized content (> 10 MB) starting with PDF header
    oversized_bytes = VALID_PDF + (b"A" * (10 * 1024 * 1024 + 1024))
    res = client.post(
        f"/api/v1/fdrs/{fdr.id}/documents",
        files={"file": ("oversized.pdf", oversized_bytes, "application/pdf")},
        data={"document_type": "ORIGINAL_FDR"},
        headers=headers,
    )
    assert res.status_code == 413
    assert "exceeds" in res.text.lower() or "too large" in res.text.lower()


def test_empty_file_rejection(client, setup_doc_test_env):
    """Verifies that a 0-byte file is rejected with 400 Bad Request."""
    _, TestingSession, _ = setup_doc_test_env
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    fdr = session.query(FDR).filter_by(institution_id=officer.institution_id).first()
    headers = auth_headers(officer)
    session.close()

    res = client.post(
        f"/api/v1/fdrs/{fdr.id}/documents",
        files={"file": ("empty.pdf", b"", "application/pdf")},
        data={"document_type": "ORIGINAL_FDR"},
        headers=headers,
    )
    assert res.status_code == 400
    assert "empty" in res.text.lower()


def test_unsupported_file_extension_rejection(client, setup_doc_test_env):
    """Verifies that executable, archive, or office document formats are rejected with 415."""
    _, TestingSession, _ = setup_doc_test_env
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    fdr = session.query(FDR).filter_by(institution_id=officer.institution_id).first()
    headers = auth_headers(officer)
    session.close()

    for bad_name in ["malware.exe", "script.sh", "doc.docx", "data.zip"]:
        res = client.post(
            f"/api/v1/fdrs/{fdr.id}/documents",
            files={"file": (bad_name, b"random content binary", "application/octet-stream")},
            data={"document_type": "ORIGINAL_FDR"},
            headers=headers,
        )
        assert res.status_code == 415
        assert "unsupported" in res.text.lower()


def test_signature_magic_bytes_mismatch_rejection(client, setup_doc_test_env):
    """
    Verifies that files with forged extensions but mismatched binary magic bytes
    are rejected with 400 or 415.
    """
    _, TestingSession, _ = setup_doc_test_env
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    fdr = session.query(FDR).filter_by(institution_id=officer.institution_id).first()
    headers = auth_headers(officer)
    session.close()

    # 1. Plain text disguised as .pdf
    res1 = client.post(
        f"/api/v1/fdrs/{fdr.id}/documents",
        files={"file": ("forged.pdf", b"This is just plain text not a pdf", "application/pdf")},
        headers=headers,
    )
    assert res1.status_code in (400, 415)
    assert "signature" in res1.text.lower() or "mismatch" in res1.text.lower() or "invalid" in res1.text.lower()

    # 2. PDF disguised as .png
    res2 = client.post(
        f"/api/v1/fdrs/{fdr.id}/documents",
        files={"file": ("forged.png", VALID_PDF, "image/png")},
        headers=headers,
    )
    assert res2.status_code in (400, 415)


def test_path_traversal_filename_sanitization(client, setup_doc_test_env):
    """
    Verifies that filenames containing directory traversal characters (../ or ..\\)
    are strictly sanitized to safe basenames and cannot escape the storage root.
    """
    _, TestingSession, storage_root = setup_doc_test_env
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    fdr = session.query(FDR).filter_by(institution_id=officer.institution_id).first()
    headers = auth_headers(officer)
    session.close()

    res = client.post(
        f"/api/v1/fdrs/{fdr.id}/documents",
        files={"file": ("../../../../evil_traversal.pdf", VALID_PDF, "application/pdf")},
        data={"document_type": "ORIGINAL_FDR"},
        headers=headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["file_name"] == "evil_traversal.pdf"
    assert ".." not in data["file_name"]

    # Verify that file exists only inside storage_root
    session = TestingSession()
    doc_ver = session.query(DocumentVersion).filter_by(id=data["document_id"]).first()
    actual_path = os.path.normpath(os.path.join(storage_root, doc_ver.storage_key))
    assert os.path.commonpath([storage_root]) == os.path.commonpath([storage_root, actual_path])
    assert os.path.exists(actual_path)
    session.close()


# ============================================================================
# Task 6: Authenticated Endpoints, Download, RBAC & IDOR
# ============================================================================

def test_authenticated_document_download(client, setup_doc_test_env):
    """
    Verifies authenticated download returns exact binary bytes, correct Content-Type,
    and Content-Disposition filename without exposing internal paths.
    """
    _, TestingSession, _ = setup_doc_test_env
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    fdr = session.query(FDR).filter_by(institution_id=officer.institution_id).first()
    headers = auth_headers(officer)
    session.close()

    # Upload test document
    up_res = client.post(
        f"/api/v1/fdrs/{fdr.id}/documents",
        files={"file": ("official_fdr.pdf", VALID_PDF, "application/pdf")},
        headers=headers,
    )
    doc_id = up_res.json()["document_id"]

    # Download document
    dl_res = client.get(f"/api/v1/documents/{doc_id}/download", headers=headers)
    assert dl_res.status_code == 200
    assert dl_res.content == VALID_PDF
    assert "application/pdf" in dl_res.headers.get("content-type", "")
    assert 'attachment; filename="official_fdr.pdf"' in dl_res.headers.get("content-disposition", "")


def test_anonymous_access_denied_on_all_document_routes(client, setup_doc_test_env):
    """Verifies that unauthenticated requests to document endpoints return 401 Unauthorized."""
    # List documents
    res1 = client.get("/api/v1/fdrs/1/documents")
    assert res1.status_code == 401

    # Metadata detail
    res2 = client.get("/api/v1/documents/1")
    assert res2.status_code == 401

    # Download
    res3 = client.get("/api/v1/documents/1/download")
    assert res3.status_code == 401

    # Upload
    res4 = client.post("/api/v1/fdrs/1/documents", files={"file": ("test.pdf", VALID_PDF, "application/pdf")})
    assert res4.status_code == 401


def test_cross_institution_idor_prevention(client, setup_doc_test_env):
    """
    Strict IDOR test: Officer from Institution B is forbidden (403) from listing,
    viewing metadata, downloading, or uploading documents for Institution A's FDR.
    """
    _, TestingSession, _ = setup_doc_test_env
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    officer_b = session.query(User).filter_by(username="officer_venkatesh").first()
    assert officer_a.institution_id != officer_b.institution_id

    fdr_a = session.query(FDR).filter_by(institution_id=officer_a.institution_id).first()
    headers_a = auth_headers(officer_a)
    headers_b = auth_headers(officer_b)
    session.close()

    # Officer A uploads document to FDR A
    up_res = client.post(
        f"/api/v1/fdrs/{fdr_a.id}/documents",
        files={"file": ("inst_a_receipt.pdf", VALID_PDF, "application/pdf")},
        headers=headers_a,
    )
    assert up_res.status_code == 201
    doc_a_id = up_res.json()["document_id"]

    # 1. Officer B attempts to list Institution A's documents -> 403
    list_res = client.get(f"/api/v1/fdrs/{fdr_a.id}/documents", headers=headers_b)
    assert list_res.status_code == 403

    # 2. Officer B attempts to view metadata of Institution A's document -> 403
    meta_res = client.get(f"/api/v1/documents/{doc_a_id}", headers=headers_b)
    assert meta_res.status_code == 403

    # 3. Officer B attempts to download Institution A's document -> 403
    dl_res = client.get(f"/api/v1/documents/{doc_a_id}/download", headers=headers_b)
    assert dl_res.status_code == 403

    # 4. Officer B attempts to upload document to Institution A's FDR -> 403
    forged_up = client.post(
        f"/api/v1/fdrs/{fdr_a.id}/documents",
        files={"file": ("tamper.pdf", VALID_PDF, "application/pdf")},
        headers=headers_b,
    )
    assert forged_up.status_code == 403


def test_regulatory_oversight_roles_can_access_documents(client, setup_doc_test_env):
    """
    Verifies that regulatory roles (AICTE_ADMIN, VERIFICATION_OFFICER, APPROVING_AUTHORITY)
    have oversight access to list, inspect metadata, and download documents across institutions.
    """
    _, TestingSession, _ = setup_doc_test_env
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    fdr_a = session.query(FDR).filter_by(institution_id=officer_a.institution_id).first()
    admin = session.query(User).filter_by(username="admin_sridhar").first()
    verifier = session.query(User).filter_by(username="verif_malhotra").first()
    approver = session.query(User).filter_by(username="approver_kumar").first()
    headers_a = auth_headers(officer_a)
    session.close()

    # Upload document
    up = client.post(
        f"/api/v1/fdrs/{fdr_a.id}/documents",
        files={"file": ("audit_sample.pdf", VALID_PDF, "application/pdf")},
        headers=headers_a,
    )
    doc_id = up.json()["document_id"]

    for user in [admin, verifier, approver]:
        h = auth_headers(user)
        # List
        r_list = client.get(f"/api/v1/fdrs/{fdr_a.id}/documents", headers=h)
        assert r_list.status_code == 200, f"Role {user.role} failed list"

        # Metadata
        r_meta = client.get(f"/api/v1/documents/{doc_id}", headers=h)
        assert r_meta.status_code == 200, f"Role {user.role} failed meta"
        assert r_meta.json()["document_id"] == doc_id
        assert "storage_key" not in r_meta.json()

        # Download
        r_dl = client.get(f"/api/v1/documents/{doc_id}/download", headers=h)
        assert r_dl.status_code == 200, f"Role {user.role} failed download"
        assert r_dl.content == VALID_PDF


# ============================================================================
# Task 8: Version Preservation & Workflow Evidence Linking
# ============================================================================

def test_document_version_preservation_on_replacement(client, setup_doc_test_env):
    """
    Verifies that uploading a replacement/corrected document:
    1. Bumps the version number (v1 -> v2)
    2. Keeps the previous version record and file intact
    3. Allows both versions to be independently retrieved and downloaded
    """
    _, TestingSession, _ = setup_doc_test_env
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    inst_id = officer.institution_id

    # Create dedicated FDR for versioning test
    test_fdr = FDR(
        fdr_number="FDR-VER-TEST-001",
        institution_id=inst_id,
        bank_name="Canara Bank",
        branch="Shivajinagar",
        ifsc="CNRB0000123",
        amount=1500000.0,
        issue_date=date(2026, 1, 1),
        maturity_date=date(2027, 1, 1),
        status=FDRStatus.DRAFT.value,
        created_by_id=officer.id,
    )
    session.add(test_fdr)
    session.commit()
    fdr_id = test_fdr.id
    headers = auth_headers(officer)
    session.close()

    # 1. Upload Version 1
    content_v1 = VALID_PDF
    sha_v1 = hashlib.sha256(content_v1).hexdigest()
    res1 = client.post(
        f"/api/v1/fdrs/{fdr_id}/documents",
        files={"file": ("deposit_v1.pdf", content_v1, "application/pdf")},
        data={"document_type": "ORIGINAL_FDR"},
        headers=headers,
    )
    assert res1.status_code == 201
    doc1 = res1.json()
    assert doc1["version"] == 1
    assert doc1["sha256"] == sha_v1
    id_v1 = doc1["document_id"]

    # 2. Upload Version 2 (Corrected/Renewed receipt)
    content_v2 = VALID_JPEG
    sha_v2 = hashlib.sha256(content_v2).hexdigest()
    res2 = client.post(
        f"/api/v1/fdrs/{fdr_id}/documents",
        files={"file": ("deposit_v2.jpg", content_v2, "image/jpeg")},
        data={"document_type": "ORIGINAL_FDR"},
        headers=headers,
    )
    assert res2.status_code == 201
    doc2 = res2.json()
    assert doc2["version"] == 2
    assert doc2["sha256"] == sha_v2
    id_v2 = doc2["document_id"]
    assert id_v1 != id_v2

    # 3. List all versions for FDR
    list_res = client.get(f"/api/v1/fdrs/{fdr_id}/documents", headers=headers)
    assert list_res.status_code == 200
    versions = list_res.json()
    assert len(versions) == 2
    assert [v["version"] for v in versions] == [1, 2]

    # 4. Independently download Version 1 and verify byte preservation
    dl_v1 = client.get(f"/api/v1/documents/{id_v1}/download", headers=headers)
    assert dl_v1.status_code == 200
    assert dl_v1.content == content_v1
    assert "application/pdf" in dl_v1.headers.get("content-type", "")

    # 5. Independently download Version 2 and verify byte preservation
    dl_v2 = client.get(f"/api/v1/documents/{id_v2}/download", headers=headers)
    assert dl_v2.status_code == 200
    assert dl_v2.content == content_v2
    assert "image/jpeg" in dl_v2.headers.get("content-type", "")


def test_workflow_evidence_linking_to_document_version(client, setup_doc_test_env):
    """
    Verifies that when an FDR is verified and approved, the specific document version
    is linked to VerificationRecord and ApprovalRecord as immutable workflow evidence.
    Subsequent document replacements do NOT overwrite prior decision evidence.
    """
    _, TestingSession, _ = setup_doc_test_env
    session = TestingSession()
    officer = session.query(User).filter_by(username="officer_deshmukh").first()
    verifier = session.query(User).filter_by(username="verif_malhotra").first()
    approver = session.query(User).filter_by(username="approver_kumar").first()

    # Create fresh draft FDR
    fdr = FDR(
        fdr_number="FDR-EVIDENCE-001",
        institution_id=officer.institution_id,
        bank_name="Union Bank of India",
        branch="Camp Branch",
        ifsc="UBIN0000456",
        amount=800000.0,
        issue_date=date(2026, 2, 1),
        maturity_date=date(2027, 2, 1),
        status=FDRStatus.DRAFT.value,
        created_by_id=officer.id,
    )
    session.add(fdr)
    session.commit()
    fdr_id = fdr.id
    headers_officer = auth_headers(officer)
    headers_verifier = auth_headers(verifier)
    headers_approver = auth_headers(approver)
    session.close()

    # Step 1: Upload document version 1
    up_v1 = client.post(
        f"/api/v1/fdrs/{fdr_id}/documents",
        files={"file": ("initial_evidence_v1.pdf", VALID_PDF, "application/pdf")},
        data={"document_type": "ORIGINAL_FDR"},
        headers=headers_officer,
    )
    assert up_v1.status_code == 201
    doc_v1_id = up_v1.json()["document_id"]

    # Step 2: Submit FDR referencing document version 1
    sub_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/submit",
        json={"supporting_document_id": doc_v1_id, "remarks": "Submitting with receipt v1"},
        headers=headers_officer,
    )
    assert sub_res.status_code == 200
    assert sub_res.json()["status"] == FDRStatus.SUBMITTED.value

    # Step 3: Verification Officer verifies FDR
    verif_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/verify",
        json={"decision": "VERIFIED", "remarks": "Checked document v1 - details match."},
        headers=headers_verifier,
    )
    assert verif_res.status_code == 200
    verif_data = verif_res.json()
    assert verif_data["document_version_id"] == doc_v1_id

    # Step 4: Approving Authority approves FDR
    appr_res = client.post(
        f"/api/v1/fdrs/{fdr_id}/approval",
        json={"decision": "APPROVED", "remarks": "Approved with statutory council confirmation."},
        headers=headers_approver,
    )
    assert appr_res.status_code == 200
    appr_data = appr_res.json()
    assert appr_data["document_version_id"] == doc_v1_id

    # Step 5: Check database records directly
    session = TestingSession()
    v_rec = session.query(VerificationRecord).filter_by(fdr_id=fdr_id).first()
    assert v_rec is not None
    assert v_rec.document_version_id == doc_v1_id

    a_rec = session.query(ApprovalRecord).filter_by(fdr_id=fdr_id).first()
    assert a_rec is not None
    assert a_rec.document_version_id == doc_v1_id

    # Step 6: Now upload document version 2 (e.g. renewal/amendment)
    up_v2 = client.post(
        f"/api/v1/fdrs/{fdr_id}/documents",
        files={"file": ("amendment_v2.png", VALID_PNG, "image/png")},
        data={"document_type": "ORIGINAL_FDR"},
        headers=headers_officer,
    )
    assert up_v2.status_code == 201
    doc_v2_id = up_v2.json()["document_id"]
    assert doc_v2_id != doc_v1_id

    # Critical Invariant: Past verification and approval records STILL link to version 1!
    session.expire_all()
    v_rec_after = session.query(VerificationRecord).filter_by(fdr_id=fdr_id).first()
    a_rec_after = session.query(ApprovalRecord).filter_by(fdr_id=fdr_id).first()
    assert v_rec_after.document_version_id == doc_v1_id
    assert a_rec_after.document_version_id == doc_v1_id
    session.close()


def test_workflow_request_documents_lifecycle(client, setup_doc_test_env):
    """
    Verifies that workflow requests (e.g. renewal/release) support document uploads,
    version listing, and institution isolation.
    """
    _, TestingSession, _ = setup_doc_test_env
    session = TestingSession()
    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    officer_b = session.query(User).filter_by(username="officer_venkatesh").first()
    admin = session.query(User).filter_by(username="admin_sridhar").first()

    # Create active FDR and renewal request for Institution A
    fdr_a = FDR(
        fdr_number="FDR-REQ-DOC-001",
        institution_id=officer_a.institution_id,
        bank_name="Bank of Baroda",
        branch="Kothrud",
        ifsc="BARB0KOTHRU",
        amount=1200000.0,
        issue_date=date(2025, 1, 1),
        maturity_date=date(2026, 1, 1),
        status=FDRStatus.ACTIVE.value,
        created_by_id=officer_a.id,
    )
    session.add(fdr_a)
    session.flush()

    req_a = WorkflowRequest(
        fdr_id=fdr_a.id,
        request_type="RENEWAL",
        status="SUBMITTED",
        created_by_id=officer_a.id,
        reason="Periodic tenure renewal",
    )
    session.add(req_a)
    session.commit()
    req_id = req_a.id
    headers_a = auth_headers(officer_a)
    headers_b = auth_headers(officer_b)
    headers_admin = auth_headers(admin)
    session.close()

    # 1. Officer A uploads supporting document for request
    up_res = client.post(
        f"/api/v1/requests/{req_id}/documents",
        files={"file": ("renewal_letter.pdf", VALID_PDF, "application/pdf")},
        data={"document_type": "RENEWAL_DOCUMENT"},
        headers=headers_a,
    )
    assert up_res.status_code == 201
    doc_data = up_res.json()
    assert doc_data["request_id"] == req_id
    assert doc_data["file_name"] == "renewal_letter.pdf"

    # 2. Officer A lists documents for request
    list_a = client.get(f"/api/v1/requests/{req_id}/documents", headers=headers_a)
    assert list_a.status_code == 200
    assert len(list_a.json()) == 1

    # 3. Officer B (different institution) is forbidden
    list_b = client.get(f"/api/v1/requests/{req_id}/documents", headers=headers_b)
    assert list_b.status_code == 403

    up_b = client.post(
        f"/api/v1/requests/{req_id}/documents",
        files={"file": ("tamper.pdf", VALID_PDF, "application/pdf")},
        headers=headers_b,
    )
    assert up_b.status_code == 403

    # 4. AICTE Admin can list request documents
    list_admin = client.get(f"/api/v1/requests/{req_id}/documents", headers=headers_admin)
    assert list_admin.status_code == 200
    assert len(list_admin.json()) == 1
