import pytest
import hashlib
import tempfile
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.enums import UserRole, FDRStatus
from app.models.institution import Institution
from app.models.user import User
from app.models.fdr import FDR
from app.models.document import DocumentVersion
from app.storage import (
    save_document_version,
    replace_document_version,
    get_document_versions,
    get_latest_document_version,
    authorize_document_access,
    authorize_document_upload,
    read_file,
    verify_file_integrity,
    format_document_response,
    UnauthorizedDocumentAccessError,
    FileTooLargeError,
    UnsupportedFileTypeError,
)
from app.history import ImmutableRecordError

# Test binary fixtures
PDF_V1 = b"%PDF-1.4\n1 0 obj<</Title (Version 1 FDR Receipt)>>endobj\n%%EOF"
PDF_V2 = b"%PDF-1.5\n1 0 obj<</Title (Version 2 Corrected FDR Receipt)>>endobj\n%%EOF"
PDF_V3 = b"%PDF-1.6\n1 0 obj<</Title (Version 3 Renewal FDR Receipt)>>endobj\n%%EOF"


@pytest.fixture
def temp_storage():
    with tempfile.TemporaryDirectory() as tmp_dir:
        yield tmp_dir


@pytest.fixture
def db_session():
    """In-memory SQLite session with two isolated institutions and users."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        # Institution A
        inst_a = Institution(
            aicte_pid="1-11111111",
            name="Delhi Institute of Technology",
            region="nro",
            state="Delhi",
            city="New Delhi",
            sponsoring_trust="DIT Trust",
            status="Active",
        )
        # Institution B
        inst_b = Institution(
            aicte_pid="1-22222222",
            name="Mumbai College of Engineering",
            region="wro",
            state="Maharashtra",
            city="Mumbai",
            sponsoring_trust="MCE Trust",
            status="Active",
        )
        session.add_all([inst_a, inst_b])
        session.flush()

        # Users
        officer_a = User(
            email="officer_a@dit.edu",
            username="officer_a",
            hashed_password="pw",
            full_name="Officer DIT",
            role=UserRole.INSTITUTION_OFFICER.value,
            institution_id=inst_a.id,
        )
        officer_b = User(
            email="officer_b@mce.edu",
            username="officer_b",
            hashed_password="pw",
            full_name="Officer MCE",
            role=UserRole.INSTITUTION_OFFICER.value,
            institution_id=inst_b.id,
        )
        verif_officer = User(
            email="verif@aicte.gov.in",
            username="verif_aicte",
            hashed_password="pw",
            full_name="AICTE Verifier",
            role=UserRole.VERIFICATION_OFFICER.value,
        )
        approver = User(
            email="approver@aicte.gov.in",
            username="approver_aicte",
            hashed_password="pw",
            full_name="AICTE Approver",
            role=UserRole.APPROVING_AUTHORITY.value,
        )
        admin = User(
            email="admin@aicte.gov.in",
            username="admin_aicte",
            hashed_password="pw",
            full_name="AICTE Super Admin",
            role=UserRole.AICTE_ADMIN.value,
        )
        session.add_all([officer_a, officer_b, verif_officer, approver, admin])
        session.flush()

        # FDR for Institution A
        fdr_a = FDR(
            fdr_number="FDR-DIT-001",
            institution_id=inst_a.id,
            bank_name="State Bank of India",
            branch="Connaught Place",
            ifsc="SBIN0000691",
            amount=5000000.0,
            issue_date=date(2024, 1, 1),
            maturity_date=date(2027, 1, 1),
            status=FDRStatus.SUBMITTED.value,
            created_by_id=officer_a.id,
        )
        # FDR for Institution B
        fdr_b = FDR(
            fdr_number="FDR-MCE-001",
            institution_id=inst_b.id,
            bank_name="Bank of India",
            branch="Fort",
            ifsc="BKID0000100",
            amount=4000000.0,
            issue_date=date(2024, 2, 1),
            maturity_date=date(2027, 2, 1),
            status=FDRStatus.SUBMITTED.value,
            created_by_id=officer_b.id,
        )
        session.add_all([fdr_a, fdr_b])
        session.commit()

        yield session
    finally:
        session.close()


def test_document_version_metadata_accuracy(db_session, temp_storage):
    """Verifies that an uploaded document records all mandatory metadata accurately."""
    fdr_a = db_session.query(FDR).filter_by(fdr_number="FDR-DIT-001").first()
    officer_a = db_session.query(User).filter_by(username="officer_a").first()

    expected_hash = hashlib.sha256(PDF_V1).hexdigest().lower()
    expected_size = len(PDF_V1)

    doc_v1 = save_document_version(
        session=db_session,
        document_type="FDR_RECEIPT",
        content=PDF_V1,
        original_filename="receipt_v1.pdf",
        uploaded_by_id=officer_a.id,
        fdr_id=fdr_a.id,
        storage_root=temp_storage,
    )
    db_session.commit()

    assert doc_v1.id is not None
    assert doc_v1.version == 1
    assert doc_v1.file_name == "receipt_v1.pdf"
    assert doc_v1.file_size == expected_size
    assert doc_v1.mime_type == "application/pdf"
    assert doc_v1.sha256_hash == expected_hash
    assert doc_v1.uploaded_by_id == officer_a.id
    assert doc_v1.created_at is not None

    # Storage key must be purely relative, no absolute paths
    assert not doc_v1.storage_key.startswith("/")
    assert not doc_v1.storage_key.startswith("\\")
    assert ":" not in doc_v1.storage_key
    assert doc_v1.storage_key.startswith("fdr/")

    # File integrity check
    assert verify_file_integrity(doc_v1.storage_key, expected_hash, storage_root=temp_storage) is True


def test_document_replacement_preserves_old_version(db_session, temp_storage):
    """
    CRITICAL INVARIANT: Replacing a document creates a new version;
    it must NEVER overwrite or delete previous evidence.
    """
    fdr_a = db_session.query(FDR).filter_by(fdr_number="FDR-DIT-001").first()
    officer_a = db_session.query(User).filter_by(username="officer_a").first()

    # 1. Upload initial document (v1)
    doc_v1 = save_document_version(
        session=db_session,
        document_type="FDR_RECEIPT",
        content=PDF_V1,
        original_filename="original_fdr_receipt.pdf",
        uploaded_by_id=officer_a.id,
        fdr_id=fdr_a.id,
        storage_root=temp_storage,
    )
    db_session.commit()
    v1_key = doc_v1.storage_key
    v1_hash = doc_v1.sha256_hash

    # 2. Replace with corrected document (v2)
    prior_doc, doc_v2 = replace_document_version(
        session=db_session,
        document_type="FDR_RECEIPT",
        content=PDF_V2,
        original_filename="corrected_fdr_receipt.pdf",
        uploader=officer_a,
        fdr_id=fdr_a.id,
        storage_root=temp_storage,
    )
    db_session.commit()

    # 3. Assertions on versions
    assert prior_doc.id == doc_v1.id
    assert prior_doc.version == 1
    assert doc_v2.version == 2
    assert doc_v2.id != doc_v1.id
    assert doc_v2.storage_key != v1_key
    assert doc_v2.sha256_hash != v1_hash

    # 4. Verify both physical files exist on disk with their exact original bytes
    v1_bytes = read_file(v1_key, storage_root=temp_storage)
    v2_bytes = read_file(doc_v2.storage_key, storage_root=temp_storage)
    assert v1_bytes == PDF_V1
    assert v2_bytes == PDF_V2

    # 5. Verify database retains both versions
    all_docs = db_session.query(DocumentVersion).filter_by(fdr_id=fdr_a.id).order_by(DocumentVersion.version.asc()).all()
    assert len(all_docs) == 2
    assert all_docs[0].version == 1
    assert all_docs[1].version == 2


def test_document_versions_ordered_retrieval(db_session, temp_storage):
    """Verifies that get_document_versions and get_latest_document_version work correctly."""
    fdr_a = db_session.query(FDR).filter_by(fdr_number="FDR-DIT-001").first()
    officer_a = db_session.query(User).filter_by(username="officer_a").first()

    # Upload versions 1, 2, 3
    for v_num, content in [(1, PDF_V1), (2, PDF_V2), (3, PDF_V3)]:
        save_document_version(
            session=db_session,
            document_type="FDR_RECEIPT",
            content=content,
            original_filename=f"fdr_v{v_num}.pdf",
            uploaded_by_id=officer_a.id,
            fdr_id=fdr_a.id,
            storage_root=temp_storage,
        )
    db_session.commit()

    versions = get_document_versions(db_session, fdr_id=fdr_a.id, document_type="FDR_RECEIPT")
    assert len(versions) == 3
    assert [v.version for v in versions] == [1, 2, 3]

    latest = get_latest_document_version(db_session, fdr_id=fdr_a.id, document_type="FDR_RECEIPT")
    assert latest is not None
    assert latest.version == 3
    assert latest.file_name == "fdr_v3.pdf"


def test_cross_institution_document_access_rejected(db_session, temp_storage):
    """Enforces institution isolation: Officer from Institution B cannot access Institution A's document."""
    fdr_a = db_session.query(FDR).filter_by(fdr_number="FDR-DIT-001").first()
    officer_a = db_session.query(User).filter_by(username="officer_a").first()
    officer_b = db_session.query(User).filter_by(username="officer_b").first()

    doc_a = save_document_version(
        session=db_session,
        document_type="FDR_RECEIPT",
        content=PDF_V1,
        original_filename="dit_secret_fdr.pdf",
        uploaded_by_id=officer_a.id,
        fdr_id=fdr_a.id,
        storage_root=temp_storage,
    )
    db_session.commit()

    # Officer B attempts access to Officer A's document -> REJECTED
    with pytest.raises(UnauthorizedDocumentAccessError, match="Access denied"):
        authorize_document_access(user=officer_b, document=doc_a)


def test_same_institution_officer_can_access(db_session, temp_storage):
    """Verifies that an Institution Officer can access documents from their own institution."""
    fdr_a = db_session.query(FDR).filter_by(fdr_number="FDR-DIT-001").first()
    officer_a = db_session.query(User).filter_by(username="officer_a").first()

    doc_a = save_document_version(
        session=db_session,
        document_type="FDR_RECEIPT",
        content=PDF_V1,
        original_filename="dit_receipt.pdf",
        uploaded_by_id=officer_a.id,
        fdr_id=fdr_a.id,
        storage_root=temp_storage,
    )
    db_session.commit()

    assert authorize_document_access(user=officer_a, document=doc_a) is True


def test_aicte_admin_and_officers_can_access_cross_institution(db_session, temp_storage):
    """Verifies that AICTE Admin, Verifiers, and Approvers can access documents across institutions."""
    fdr_a = db_session.query(FDR).filter_by(fdr_number="FDR-DIT-001").first()
    officer_a = db_session.query(User).filter_by(username="officer_a").first()
    verif = db_session.query(User).filter_by(role=UserRole.VERIFICATION_OFFICER.value).first()
    approver = db_session.query(User).filter_by(role=UserRole.APPROVING_AUTHORITY.value).first()
    admin = db_session.query(User).filter_by(role=UserRole.AICTE_ADMIN.value).first()

    doc_a = save_document_version(
        session=db_session,
        document_type="FDR_RECEIPT",
        content=PDF_V1,
        original_filename="dit_receipt.pdf",
        uploaded_by_id=officer_a.id,
        fdr_id=fdr_a.id,
        storage_root=temp_storage,
    )
    db_session.commit()

    assert authorize_document_access(user=verif, document=doc_a) is True
    assert authorize_document_access(user=approver, document=doc_a) is True
    assert authorize_document_access(user=admin, document=doc_a) is True


def test_unauthorized_cross_institution_upload_rejected(db_session, temp_storage):
    """Asserts that an Institution Officer cannot upload documents to another institution's FDR."""
    fdr_a = db_session.query(FDR).filter_by(fdr_number="FDR-DIT-001").first()
    officer_b = db_session.query(User).filter_by(username="officer_b").first()

    # Officer B tries to upload to FDR A -> REJECTED
    with pytest.raises(UnauthorizedDocumentAccessError, match="Unauthorized upload"):
        replace_document_version(
            session=db_session,
            document_type="FDR_RECEIPT",
            content=PDF_V1,
            original_filename="attack.pdf",
            uploader=officer_b,
            fdr_id=fdr_a.id,
            storage_root=temp_storage,
        )


def test_document_version_immutability(db_session, temp_storage):
    """Verifies that DocumentVersion database records are immutable (cannot be updated or deleted)."""
    fdr_a = db_session.query(FDR).filter_by(fdr_number="FDR-DIT-001").first()
    officer_a = db_session.query(User).filter_by(username="officer_a").first()

    doc = save_document_version(
        session=db_session,
        document_type="FDR_RECEIPT",
        content=PDF_V1,
        original_filename="immutable.pdf",
        uploaded_by_id=officer_a.id,
        fdr_id=fdr_a.id,
        storage_root=temp_storage,
    )
    db_session.commit()

    # Attempt modification
    doc.storage_key = "fdr/1/tampered_path.pdf"
    with pytest.raises(ImmutableRecordError, match="append-only and cannot be modified"):
        db_session.commit()
    db_session.rollback()

    # Attempt deletion
    db_session.delete(doc)
    with pytest.raises(ImmutableRecordError, match="append-only and cannot be deleted"):
        db_session.commit()
    db_session.rollback()


def test_invalid_upload_rejected_preserving_existing_versions(db_session, temp_storage):
    """Verifies that an invalid upload attempt is rejected and leaves existing versions intact."""
    fdr_a = db_session.query(FDR).filter_by(fdr_number="FDR-DIT-001").first()
    officer_a = db_session.query(User).filter_by(username="officer_a").first()

    # Valid version 1 exists
    doc_v1 = save_document_version(
        session=db_session,
        document_type="FDR_RECEIPT",
        content=PDF_V1,
        original_filename="valid_v1.pdf",
        uploaded_by_id=officer_a.id,
        fdr_id=fdr_a.id,
        storage_root=temp_storage,
    )
    db_session.commit()

    # Attempt replacement with unsupported .exe extension
    with pytest.raises(UnsupportedFileTypeError):
        replace_document_version(
            session=db_session,
            document_type="FDR_RECEIPT",
            content=PDF_V2,
            original_filename="malicious.exe",
            uploader=officer_a,
            fdr_id=fdr_a.id,
            storage_root=temp_storage,
        )

    # Attempt replacement with oversized file (> 10 MB)
    oversized = b"%PDF-" + b"0" * (10 * 1024 * 1024 + 50)
    with pytest.raises(FileTooLargeError):
        replace_document_version(
            session=db_session,
            document_type="FDR_RECEIPT",
            content=oversized,
            original_filename="huge.pdf",
            uploader=officer_a,
            fdr_id=fdr_a.id,
            storage_root=temp_storage,
        )

    # Invariant check: only version 1 exists
    docs = get_document_versions(db_session, fdr_id=fdr_a.id)
    assert len(docs) == 1
    assert docs[0].version == 1
    assert docs[0].file_name == "valid_v1.pdf"
