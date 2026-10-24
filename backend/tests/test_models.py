from datetime import date, datetime, timezone
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

from app.database import Base
from app.models import (
    UserRole,
    FDRStatus,
    RequestType,
    RenewalStatus,
    ReleaseStatus,
    DiscrepancySeverity,
    ProvenanceSource,
    Institution,
    User,
    FDR,
    FieldProvenance,
    DocumentVersion,
    WorkflowRequest,
    VerificationRecord,
    ApprovalRecord,
    AuditLog,
    Notification,
)

@pytest.fixture(scope="function")
def db_session():
    """Create fresh isolated in-memory SQLite database with foreign keys enabled."""
    test_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

    @event.listens_for(test_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)

def test_create_institution_and_user(db_session):
    """Verify institution and user modeling with role and foreign key."""
    inst = Institution(
        aicte_pid="1-10928374",
        name="St. Xavier's Engineering College",
        region="wro",
        state="Maharashtra",
        city="Pune",
        sponsoring_trust="St. Xavier's Technical Education Society",
        status="Active"
    )
    db_session.add(inst)
    db_session.commit()

    user = User(
        email="inst.officer@sxec.edu",
        username="anand_deshmukh",
        hashed_password="sha256_mock_hash_for_testing",
        full_name="Dr. Anand Deshmukh",
        role=UserRole.INSTITUTION_OFFICER.value,
        institution_id=inst.id
    )
    db_session.add(user)
    db_session.commit()

    assert user.id is not None
    assert user.institution.name == "St. Xavier's Engineering College"

def test_fdr_amount_positive_constraint(db_session):
    """Verify constraint rejects amount <= 0."""
    inst = Institution(
        aicte_pid="1-99887766",
        name="Test Institute",
        region="sro",
        state="Karnataka",
        city="Bengaluru",
        sponsoring_trust="Test Trust",
        status="Active"
    )
    db_session.add(inst)
    db_session.commit()

    # Attempt to insert zero or negative amount
    fdr_invalid = FDR(
        fdr_number="FDR-TEST-001",
        institution_id=inst.id,
        bank_name="State Bank of India",
        branch="Main Branch",
        ifsc="SBIN0001234",
        amount=0,  # Invalid: must be > 0
        issue_date=date(2024, 1, 1),
        maturity_date=date(2029, 1, 1),
        status=FDRStatus.SUBMITTED.value
    )
    db_session.add(fdr_invalid)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

def test_fdr_maturity_date_constraint(db_session):
    """Verify constraint rejects maturity_date < issue_date."""
    inst = Institution(
        aicte_pid="1-55443322",
        name="Test Institute 2",
        region="nro",
        state="Delhi",
        city="New Delhi",
        sponsoring_trust="Delhi Trust",
        status="Active"
    )
    db_session.add(inst)
    db_session.commit()

    fdr_invalid = FDR(
        fdr_number="FDR-TEST-002",
        institution_id=inst.id,
        bank_name="Punjab National Bank",
        branch="HQ Branch",
        ifsc="PUNB0001234",
        amount=5000000,
        issue_date=date(2024, 6, 1),
        maturity_date=date(2023, 6, 1),  # Invalid: maturity before issue
        status=FDRStatus.SUBMITTED.value
    )
    db_session.add(fdr_invalid)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

def test_fdr_foreign_key_constraint(db_session):
    """Verify foreign key rejects non-existent institution_id."""
    fdr_invalid = FDR(
        fdr_number="FDR-TEST-003",
        institution_id=999999,  # Non-existent institution
        bank_name="Canara Bank",
        branch="City Branch",
        ifsc="CNRB0001234",
        amount=1000000,
        issue_date=date(2024, 1, 1),
        maturity_date=date(2029, 1, 1),
        status=FDRStatus.SUBMITTED.value
    )
    db_session.add(fdr_invalid)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

def test_approval_record_exclusive_target_constraint(db_session):
    """Verify approval record constraint: exactly one of fdr_id or request_id must be set."""
    inst = Institution(
        aicte_pid="1-11223344",
        name="Approval Test College",
        region="wro",
        state="Maharashtra",
        city="Mumbai",
        sponsoring_trust="Trust A",
        status="Active"
    )
    db_session.add(inst)
    db_session.commit()

    approver = User(
        email="approver@aicte.gov.in",
        username="approver_rajive",
        hashed_password="mock_password_hash",
        full_name="Prof. Rajive Kumar",
        role=UserRole.APPROVING_AUTHORITY.value
    )
    db_session.add(approver)

    fdr = FDR(
        fdr_number="FDR-APP-001",
        institution_id=inst.id,
        bank_name="SBI",
        branch="Nariman Point",
        ifsc="SBIN0000123",
        amount=10000000,
        issue_date=date(2024, 1, 1),
        maturity_date=date(2029, 1, 1),
        status=FDRStatus.PENDING_APPROVAL.value
    )
    db_session.add(fdr)
    db_session.commit()

    # Case 1: Both fdr_id and request_id are None -> INVALID
    appr_none = ApprovalRecord(
        fdr_id=None,
        request_id=None,
        approver_id=approver.id,
        decision="APPROVED",
        council_order_ref="AICTE/ORDER/001"
    )
    db_session.add(appr_none)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    # Case 2: Exactly fdr_id is set -> VALID
    appr_valid = ApprovalRecord(
        fdr_id=fdr.id,
        request_id=None,
        approver_id=approver.id,
        decision="APPROVED",
        council_order_ref="AICTE/ORDER/002"
    )
    db_session.add(appr_valid)
    db_session.commit()
    assert appr_valid.id is not None

def test_document_version_hash_constraint(db_session):
    """Verify document upload requires 64-char SHA256 and positive size."""
    inst = Institution(
        aicte_pid="1-77889900",
        name="Doc Test College",
        region="cro",
        state="Madhya Pradesh",
        city="Bhopal",
        sponsoring_trust="Bhopal Trust",
        status="Active"
    )
    db_session.add(inst)
    db_session.commit()

    uploader = User(
        email="uploader@doc.org",
        username="doc_uploader",
        hashed_password="mock_password_hash",
        full_name="Uploader Officer",
        role=UserRole.INSTITUTION_OFFICER.value
    )
    db_session.add(uploader)
    db_session.commit()

    # Invalid hash length (< 64)
    doc_bad_hash = DocumentVersion(
        document_type="FDR_RECEIPT",
        version=1,
        storage_key="docs/fdr_bad.pdf",
        file_name="receipt.pdf",
        file_size=1024,
        mime_type="application/pdf",
        sha256_hash="tooshort",  # Must be 64 chars
        uploaded_by_id=uploader.id
    )
    db_session.add(doc_bad_hash)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    # Valid doc
    valid_hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    doc_valid = DocumentVersion(
        document_type="FDR_RECEIPT",
        version=1,
        storage_key="docs/fdr_valid.pdf",
        file_name="receipt.pdf",
        file_size=2048,
        mime_type="application/pdf",
        sha256_hash=valid_hash,
        uploaded_by_id=uploader.id
    )
    db_session.add(doc_valid)
    db_session.commit()
    assert doc_valid.id is not None

def test_separate_request_types_and_statuses(db_session):
    """Verify renewal and release request types and statuses are separate from FDR lifecycle status."""
    inst = Institution(
        aicte_pid="1-44332211",
        name="Multi Workflow College",
        region="ero",
        state="West Bengal",
        city="Kolkata",
        sponsoring_trust="Kolkata Trust",
        status="Active"
    )
    db_session.add(inst)
    db_session.commit()

    user = User(
        email="officer@kolkata.edu",
        username="kolkata_officer",
        hashed_password="mock_password_hash",
        full_name="Subir Roy",
        role=UserRole.INSTITUTION_OFFICER.value,
        institution_id=inst.id
    )
    db_session.add(user)

    fdr = FDR(
        fdr_number="FDR-KOL-001",
        institution_id=inst.id,
        bank_name="Bank of Baroda",
        branch="Park Street",
        ifsc="BARB0KOLKAT",
        amount=5000000,
        issue_date=date(2020, 1, 1),
        maturity_date=date(2025, 1, 1),
        status=FDRStatus.ACTIVE.value  # FDR remains ACTIVE
    )
    db_session.add(fdr)
    db_session.commit()

    # 1. Renewal Request with RenewalStatus
    req_renewal = WorkflowRequest(
        fdr_id=fdr.id,
        request_type=RequestType.RENEWAL.value,
        status=RenewalStatus.REQUESTED.value,
        reason="Approaching maturity, 3-year extension",
        created_by_id=user.id
    )
    db_session.add(req_renewal)

    # 2. Release Request with ReleaseStatus (can coexist in history)
    req_release = WorkflowRequest(
        fdr_id=fdr.id,
        request_type=RequestType.RELEASE_REFUND.value,
        status=ReleaseStatus.AWAITING_CONFIRMATION.value,
        reason="Autonomous status granted",
        council_order_ref="AICTE/FIN/REL/2024/991",
        created_by_id=user.id
    )
    db_session.add(req_release)
    db_session.commit()

    assert req_renewal.id is not None
    assert req_release.id is not None
    assert req_renewal.request_type == "RENEWAL"
    assert req_renewal.status == "REQUESTED"
    assert req_release.request_type == "RELEASE_REFUND"
    assert req_release.status == "AWAITING_CONFIRMATION"
    # Invariant: FDR status remains distinct
    assert fdr.status == "ACTIVE"
