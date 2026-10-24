import os
import hashlib
import tempfile
import pytest
from datetime import date
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.enums import UserRole
from app.models.institution import Institution
from app.models.user import User
from app.models.fdr import FDR
from app.models.document import DocumentVersion
from app.storage import (
    MAX_FILE_SIZE,
    save_file,
    read_file,
    delete_file,
    verify_file_integrity,
    compute_sha256,
    validate_file,
    sanitize_filename,
    generate_storage_key,
    resolve_storage_path,
    save_document_version,
    format_document_response,
    FileEmptyError,
    FileTooLargeError,
    UnsupportedFileTypeError,
    FileSignatureMismatchError,
    CorruptedFileError,
    PathTraversalError,
    StorageFileNotFoundError,
)

# Test Binary Fixtures with valid magic bytes
VALID_PDF = b"%PDF-1.5\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n%%EOF"
VALID_JPEG = bytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48]) + bytes([0xFF, 0xD9])
VALID_PNG = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]) + bytes([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00])
VALID_WEBP = b"RIFF" + bytes([0x14, 0x00, 0x00, 0x00]) + b"WEBPVP8 " + bytes([0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])


@pytest.fixture
def temp_storage():
    """Provides a temporary, isolated storage directory for tests."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        yield tmp_dir


@pytest.fixture
def db_session():
    """In-memory SQLite session with full schema initialized."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        # Seed test institution and user with exact schema fields
        inst = Institution(
            aicte_pid="1-1234567890",
            name="Storage Test Institute",
            region="nro",
            state="Delhi",
            city="New Delhi",
            sponsoring_trust="STI Educational Trust",
            status="Active",
        )
        session.add(inst)
        session.flush()

        user = User(
            email="storage_officer@sti.edu",
            username="storage_officer",
            hashed_password="hashed_pw_test",
            full_name="Storage Officer",
            role=UserRole.INSTITUTION_OFFICER.value,
            institution_id=inst.id,
        )
        session.add(user)
        session.flush()

        fdr = FDR(
            fdr_number="FDR-STORE-101",
            institution_id=inst.id,
            bank_name="State Bank of India",
            branch="Connaught Place",
            ifsc="SBIN0000691",
            amount=500000.0,
            issue_date=date(2026, 1, 1),
            maturity_date=date(2027, 1, 1),
            created_by_id=user.id,
        )
        session.add(fdr)
        session.commit()
        yield session
    finally:
        session.close()


def test_valid_pdf_storage(temp_storage):
    """Verifies that a valid PDF file saves, hashes, and reads correctly."""
    meta = save_file(
        content=VALID_PDF,
        original_filename="original_receipt.pdf",
        category="fdr",
        entity_id=1,
        declared_mime="application/pdf",
        storage_root=temp_storage,
    )

    assert meta["file_size"] == len(VALID_PDF)
    assert meta["mime_type"] == "application/pdf"
    assert meta["detected_format"] == "pdf"
    assert meta["file_name"] == "original_receipt.pdf"
    assert len(meta["sha256_hash"]) == 64
    assert meta["sha256_hash"] == hashlib.sha256(VALID_PDF).hexdigest().lower()

    # Relative storage key check - never absolute
    storage_key = meta["storage_key"]
    assert not storage_key.startswith("/")
    assert not storage_key.startswith(chr(92))
    assert ":" not in storage_key
    assert storage_key.startswith("fdr/1/")

    # Read back and compare bytes
    retrieved = read_file(storage_key, storage_root=temp_storage)
    assert retrieved == VALID_PDF


def test_valid_image_formats(temp_storage):
    """Verifies JPEG, PNG, and WebP files validate and save correctly."""
    # JPEG
    jpeg_meta = save_file(
        content=VALID_JPEG,
        original_filename="scan.jpg",
        category="fdr",
        entity_id=2,
        declared_mime="image/jpeg",
        storage_root=temp_storage,
    )
    assert jpeg_meta["detected_format"] == "jpeg"
    assert jpeg_meta["mime_type"] == "image/jpeg"
    assert read_file(jpeg_meta["storage_key"], storage_root=temp_storage) == VALID_JPEG

    # PNG
    png_meta = save_file(
        content=VALID_PNG,
        original_filename="receipt.png",
        category="fdr",
        entity_id=2,
        declared_mime="image/png",
        storage_root=temp_storage,
    )
    assert png_meta["detected_format"] == "png"
    assert png_meta["mime_type"] == "image/png"
    assert read_file(png_meta["storage_key"], storage_root=temp_storage) == VALID_PNG

    # WebP
    webp_meta = save_file(
        content=VALID_WEBP,
        original_filename="voucher.webp",
        category="fdr",
        entity_id=2,
        declared_mime="image/webp",
        storage_root=temp_storage,
    )
    assert webp_meta["detected_format"] == "webp"
    assert webp_meta["mime_type"] == "image/webp"
    assert read_file(webp_meta["storage_key"], storage_root=temp_storage) == VALID_WEBP


def test_empty_file_rejected():
    """Asserts that 0-byte empty files are rejected."""
    with pytest.raises(FileEmptyError, match="empty"):
        validate_file("empty.pdf", b"")


def test_oversized_file_rejected():
    """Asserts that files exceeding 10 MB are rejected."""
    oversized_content = b"%PDF-" + b"0" * (MAX_FILE_SIZE + 10)
    with pytest.raises(FileTooLargeError, match="10 MB"):
        validate_file("huge.pdf", oversized_content)


def test_unsupported_extensions_rejected():
    """Asserts that non-permitted file extensions are rejected immediately."""
    unsupported_names = ["script.exe", "test.sh", "notes.txt", "doc.docx", "app.py", "archive.zip"]
    for name in unsupported_names:
        with pytest.raises(UnsupportedFileTypeError, match="Unsupported file extension"):
            validate_file(name, VALID_PDF)


def test_signature_mismatch_plain_text_disguised_as_pdf():
    """Asserts that text files disguised as PDF are rejected by signature detection."""
    fake_pdf = b"Hello, this is just plain text content with no PDF magic bytes."
    with pytest.raises(UnsupportedFileTypeError, match="Unsupported file format or invalid file signature"):
        validate_file("fake.pdf", fake_pdf)


def test_signature_mismatch_png_renamed_to_pdf():
    """Asserts that valid PNG bytes disguised as .pdf are rejected."""
    with pytest.raises(FileSignatureMismatchError, match="does not match detected format 'PNG'"):
        validate_file("document.pdf", VALID_PNG)


def test_declared_mime_mismatch():
    """Asserts that mismatched declared MIME types are rejected."""
    with pytest.raises(FileSignatureMismatchError, match="Declared MIME type"):
        validate_file("document.png", VALID_PNG, declared_mime="application/pdf")


def test_corrupted_truncated_file_rejected():
    """Asserts that truncated file signatures are rejected."""
    truncated_pdf = b"%PDF-"  # only 5 bytes, malformed
    with pytest.raises(CorruptedFileError, match="truncated PDF"):
        validate_file("truncated.pdf", truncated_pdf)

    truncated_jpeg = bytes([0xFF, 0xD8, 0xFF])  # only 3 bytes
    with pytest.raises(CorruptedFileError, match="truncated JPEG"):
        validate_file("truncated.jpg", truncated_jpeg)


def test_sha256_hash_consistency_and_integrity_check(temp_storage):
    """Verifies SHA-256 calculation and tamper detection."""
    meta = save_file(
        content=VALID_PDF,
        original_filename="verified.pdf",
        storage_root=temp_storage,
    )
    storage_key = meta["storage_key"]
    expected_hash = meta["sha256_hash"]

    # 1. Integrity check passes for unchanged file
    assert verify_file_integrity(storage_key, expected_hash, storage_root=temp_storage) is True

    # 2. Tampering detection: modify the file on disk
    file_path = resolve_storage_path(storage_key, storage_root=temp_storage)
    tampered_content = VALID_PDF + b"\n%TAMPERED%"
    file_path.write_bytes(tampered_content)

    # 3. Integrity check fails for modified file
    assert verify_file_integrity(storage_key, expected_hash, storage_root=temp_storage) is False


def test_path_traversal_attempts_blocked(temp_storage):
    """Verifies that malicious path traversal attempts are blocked and sanitized."""
    # 1. Direct traversal in storage key
    traversal_keys = [
        "../../etc/passwd",
        ".." + chr(92) + ".." + chr(92) + "Windows" + chr(92) + "System32" + chr(92) + "cmd.exe",
        "fdr/1/../../secret.txt",
        "/absolute/path/file.pdf",
        "C:/Windows/cmd.exe",
    ]
    for bad_key in traversal_keys:
        with pytest.raises(PathTraversalError):
            resolve_storage_path(bad_key, storage_root=temp_storage)

    # 2. Null byte in storage key
    with pytest.raises(PathTraversalError):
        resolve_storage_path("fdr/1/test" + chr(0) + ".pdf", storage_root=temp_storage)

    # 3. Filename sanitization strips traversal
    malicious_filename = "../../../../../etc/passwd.pdf"
    safe = sanitize_filename(malicious_filename)
    assert ".." not in safe
    assert "/" not in safe
    assert chr(92) not in safe
    assert safe == "passwd.pdf"


def test_document_version_database_persistence(db_session, temp_storage):
    """Verifies DocumentVersion records are created, version-bumped, and linked properly."""
    fdr = db_session.query(FDR).first()
    user = db_session.query(User).first()

    # Upload Version 1
    doc_v1 = save_document_version(
        session=db_session,
        document_type="FDR_RECEIPT",
        content=VALID_PDF,
        original_filename="FDR_101_Receipt.pdf",
        uploaded_by_id=user.id,
        fdr_id=fdr.id,
        storage_root=temp_storage,
    )
    db_session.commit()

    assert doc_v1.id is not None
    assert doc_v1.version == 1
    assert doc_v1.document_type == "FDR_RECEIPT"
    assert doc_v1.file_name == "FDR_101_Receipt.pdf"
    assert doc_v1.fdr_id == fdr.id
    assert not doc_v1.storage_key.startswith("/")

    # Upload Version 2 (e.g. renewal or correction)
    doc_v2 = save_document_version(
        session=db_session,
        document_type="FDR_RECEIPT",
        content=VALID_PDF,
        original_filename="FDR_101_Receipt_Corrected.pdf",
        uploaded_by_id=user.id,
        fdr_id=fdr.id,
        storage_root=temp_storage,
    )
    db_session.commit()

    assert doc_v2.id is not None
    assert doc_v2.version == 2
    assert doc_v2.id != doc_v1.id

    # Verify both versions persist in DB and storage
    all_docs = db_session.query(DocumentVersion).filter_by(fdr_id=fdr.id).all()
    assert len(all_docs) == 2
    assert read_file(doc_v1.storage_key, storage_root=temp_storage) == VALID_PDF
    assert read_file(doc_v2.storage_key, storage_root=temp_storage) == VALID_PDF


def test_format_document_response_never_exposes_storage_key_or_paths(db_session, temp_storage):
    """Verifies that API formatting NEVER returns storage_key, filesystem paths, or URLs."""
    fdr = db_session.query(FDR).first()
    user = db_session.query(User).first()

    doc = save_document_version(
        session=db_session,
        document_type="FDR_RECEIPT",
        content=VALID_PDF,
        original_filename="bank_receipt.pdf",
        uploaded_by_id=user.id,
        fdr_id=fdr.id,
        storage_root=temp_storage,
    )
    db_session.commit()

    api_response = format_document_response(doc)

    # Required metadata fields present
    assert api_response["id"] == doc.id
    assert api_response["fdr_id"] == fdr.id
    assert api_response["document_type"] == "FDR_RECEIPT"
    assert api_response["file_name"] == "bank_receipt.pdf"
    assert api_response["file_size"] == len(VALID_PDF)
    assert api_response["mime_type"] == "application/pdf"
    assert api_response["sha256_hash"] == doc.sha256_hash
    assert api_response["version"] == 1

    # SECURITY ASSERTIONS: Storage keys and server paths MUST NOT be present
    assert "storage_key" not in api_response
    assert "file_path" not in api_response
    assert "url" not in api_response
    for key, val in api_response.items():
        if isinstance(val, str):
            assert "storage" not in val.lower()
            assert chr(92) not in val
            # Only mime_type and ISO timestamp can contain slashes
            if key not in ("mime_type", "created_at"):
                assert "/" not in val
