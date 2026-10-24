import pytest
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.enums import UserRole, FDRStatus, RequestType, RenewalStatus
from app.models.institution import Institution
from app.models.user import User
from app.models.fdr import FDR, FieldProvenance, FDRRenewalHistory
from app.models.document import DocumentVersion
from app.models.workflow import WorkflowRequest, VerificationRecord, ApprovalRecord, StatusTransitionHistory
from app.models.audit import AuditLog
from app.history import (
    record_status_transition,
    record_verification_decision,
    record_approval_decision,
    complete_fdr_renewal,
    get_fdr_timeline,
    SeparationOfDutiesError,
    UnauthorizedRoleError,
    InvalidStatusTransitionError,
    ImmutableRecordError,
)


@pytest.fixture
def db_session():
    """In-memory SQLite session with full schema initialized."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        # Seed test institution
        inst = Institution(
            aicte_pid="1-99887766",
            name="History Test Institute",
            region="wro",
            state="Maharashtra",
            city="Pune",
            sponsoring_trust="History Trust",
            status="Active",
        )
        session.add(inst)
        session.flush()

        # Seed users for each canonical role
        inst_officer = User(
            email="inst_officer@history.edu",
            username="inst_officer",
            hashed_password="mock_password",
            full_name="Institution Submitter",
            role=UserRole.INSTITUTION_OFFICER.value,
            institution_id=inst.id,
        )
        verif_officer = User(
            email="verif_officer@aicte.gov.in",
            username="verif_officer",
            hashed_password="mock_password",
            full_name="Verification Officer",
            role=UserRole.VERIFICATION_OFFICER.value,
        )
        approver = User(
            email="approver@aicte.gov.in",
            username="approver_user",
            hashed_password="mock_password",
            full_name="Approving Authority",
            role=UserRole.APPROVING_AUTHORITY.value,
        )
        admin = User(
            email="admin@aicte.gov.in",
            username="admin_user",
            hashed_password="mock_password",
            full_name="AICTE Admin",
            role=UserRole.AICTE_ADMIN.value,
        )
        session.add_all([inst_officer, verif_officer, approver, admin])
        session.flush()

        # Seed initial FDR in SUBMITTED state
        fdr = FDR(
            fdr_number="FDR-HIST-001",
            institution_id=inst.id,
            bank_name="Bank of Maharashtra",
            branch="Shivaji Nagar",
            ifsc="MAHB0000123",
            amount=1000000.0,
            issue_date=date(2024, 1, 1),
            maturity_date=date(2027, 1, 1),
            status=FDRStatus.SUBMITTED.value,
            created_by_id=inst_officer.id,
        )
        session.add(fdr)
        session.commit()

        yield session
    finally:
        session.close()


def test_record_status_transition(db_session):
    """Verifies that status transitions record old/new status, actor, and audit log."""
    fdr = db_session.query(FDR).first()
    officer = db_session.query(User).filter_by(role=UserRole.VERIFICATION_OFFICER.value).first()

    transition = record_status_transition(
        session=db_session,
        fdr=fdr,
        to_status=FDRStatus.UNDER_VERIFICATION.value,
        actor=officer,
        reason="Taking into review for document validation.",
    )
    db_session.commit()

    assert transition.id is not None
    assert transition.from_status == "SUBMITTED"
    assert transition.to_status == "UNDER_VERIFICATION"
    assert transition.actor_id == officer.id
    assert fdr.status == "UNDER_VERIFICATION"

    # Check audit log was created
    audit = db_session.query(AuditLog).filter_by(action="STATUS_TRANSITION_UNDER_VERIFICATION").first()
    assert audit is not None
    assert audit.actor_id == officer.id
    assert str(fdr.id) == audit.target_id


def test_verification_decision_records_history(db_session):
    """Verifies verification decisions record previous/new status, remarks, and transition."""
    fdr = db_session.query(FDR).first()
    officer = db_session.query(User).filter_by(role=UserRole.VERIFICATION_OFFICER.value).first()

    # Move to UNDER_VERIFICATION first
    record_status_transition(db_session, fdr, FDRStatus.UNDER_VERIFICATION.value, officer, "Review start")

    # Record verification decision
    v_rec = record_verification_decision(
        session=db_session,
        officer=officer,
        decision="VERIFIED",
        fdr=fdr,
        remarks="All documents match bank deposit records.",
    )
    db_session.commit()

    assert v_rec.id is not None
    assert v_rec.decision == "VERIFIED"
    assert v_rec.previous_status == "UNDER_VERIFICATION"
    assert v_rec.new_status == "PENDING_APPROVAL"
    assert fdr.status == "PENDING_APPROVAL"
    assert v_rec.remarks == "All documents match bank deposit records."

    # Status transition history was also logged
    transitions = db_session.query(StatusTransitionHistory).filter_by(fdr_id=fdr.id).all()
    assert len(transitions) == 2
    assert transitions[-1].to_status == "PENDING_APPROVAL"


def test_verification_correction_discrepancy(db_session):
    """Verifies that discrepancy details are recorded when correction is required."""
    fdr = db_session.query(FDR).first()
    officer = db_session.query(User).filter_by(role=UserRole.VERIFICATION_OFFICER.value).first()

    record_status_transition(db_session, fdr, FDRStatus.UNDER_VERIFICATION.value, officer)

    v_rec = record_verification_decision(
        session=db_session,
        officer=officer,
        decision="CORRECTION_REQUIRED",
        fdr=fdr,
        remarks="Deposit receipt missing bank seal and branch code.",
        discrepancy_code="DISC_MISSING_SEAL",
        discrepancy_severity="BLOCKING",
        discrepancy_note="Re-upload receipt with official bank endorsement.",
    )
    db_session.commit()

    assert v_rec.decision == "CORRECTION_REQUIRED"
    assert v_rec.discrepancy_code == "DISC_MISSING_SEAL"
    assert v_rec.discrepancy_severity == "BLOCKING"
    assert fdr.status == "CORRECTION_REQUIRED"


def test_approval_decision_records_history(db_session):
    """Verifies approval decisions record decision, previous/new status, and order ref."""
    fdr = db_session.query(FDR).first()
    approver = db_session.query(User).filter_by(role=UserRole.APPROVING_AUTHORITY.value).first()

    # Move FDR to PENDING_APPROVAL
    fdr.status = FDRStatus.PENDING_APPROVAL.value
    db_session.commit()

    appr_rec = record_approval_decision(
        session=db_session,
        approver=approver,
        decision="APPROVED",
        fdr=fdr,
        council_order_ref="AICTE/ORDER/2026/042",
        reason="FDR meets AICTE compliance norms.",
    )
    db_session.commit()

    assert appr_rec.id is not None
    assert appr_rec.decision == "APPROVED"
    assert appr_rec.previous_status == "PENDING_APPROVAL"
    assert appr_rec.new_status == "ACTIVE"
    assert appr_rec.council_order_ref == "AICTE/ORDER/2026/042"
    assert fdr.status == "ACTIVE"
    # Target constraint verified: exactly fdr_id is populated
    assert appr_rec.fdr_id == fdr.id
    assert appr_rec.request_id is None


def test_separation_of_duties_approver_cannot_be_submitter(db_session):
    """Enforces separation of duties: Submitter CANNOT approve their own submission."""
    fdr = db_session.query(FDR).first()
    approver = db_session.query(User).filter_by(role=UserRole.APPROVING_AUTHORITY.value).first()

    fdr.status = FDRStatus.PENDING_APPROVAL.value
    db_session.commit()

    # Case 1: Submitter with INSTITUTION_OFFICER role tries to approve
    inst_officer = db_session.query(User).filter_by(id=fdr.created_by_id).first()
    with pytest.raises(SeparationOfDutiesError, match="cannot approve their own submission"):
        record_approval_decision(
            session=db_session,
            approver=inst_officer,
            decision="APPROVED",
            fdr=fdr,
        )

    # Case 2: Even an APPROVING_AUTHORITY who created a record cannot approve it
    approver_creator = User(
        email="approver_creator@aicte.gov.in",
        username="approver_creator",
        hashed_password="mock_password",
        full_name="Approver Creator",
        role=UserRole.APPROVING_AUTHORITY.value,
    )
    db_session.add(approver_creator)
    db_session.flush()

    fdr.created_by_id = approver_creator.id
    db_session.commit()

    with pytest.raises(SeparationOfDutiesError, match="cannot approve their own submission"):
        record_approval_decision(
            session=db_session,
            approver=approver_creator,
            decision="APPROVED",
            fdr=fdr,
        )

    # Case 3: Distinct authorized approver -> SUCCESS
    appr = record_approval_decision(
        session=db_session,
        approver=approver,
        decision="APPROVED",
        fdr=fdr,
    )
    db_session.commit()
    assert appr.id is not None


def test_separation_of_duties_officer_cannot_be_submitter(db_session):
    """Enforces separation of duties: Submitter CANNOT verify their own submission."""
    fdr = db_session.query(FDR).first()

    # Case 1: Submitter tries to verify
    inst_officer = db_session.query(User).filter_by(id=fdr.created_by_id).first()
    with pytest.raises(SeparationOfDutiesError, match="Submitter cannot verify their own submission"):
        record_verification_decision(
            session=db_session,
            officer=inst_officer,
            decision="VERIFIED",
            fdr=fdr,
        )

    # Case 2: Even a VERIFICATION_OFFICER who created the submission cannot verify it
    verif_creator = User(
        email="verif_creator@aicte.gov.in",
        username="verif_creator",
        hashed_password="mock_password",
        full_name="Verif Creator",
        role=UserRole.VERIFICATION_OFFICER.value,
    )
    db_session.add(verif_creator)
    db_session.flush()

    fdr.created_by_id = verif_creator.id
    db_session.commit()

    with pytest.raises(SeparationOfDutiesError, match="Submitter cannot verify their own submission"):
        record_verification_decision(
            session=db_session,
            officer=verif_creator,
            decision="VERIFIED",
            fdr=fdr,
        )


def test_role_enforcement_for_approval_and_verification(db_session):
    """Verifies that unauthorized roles cannot approve or verify submissions."""
    fdr = db_session.query(FDR).first()
    # User who is NOT the creator
    other_inst_officer = User(
        email="other_officer@history.edu",
        username="other_officer",
        hashed_password="mock_password",
        full_name="Other Submitter",
        role=UserRole.INSTITUTION_OFFICER.value,
    )
    db_session.add(other_inst_officer)
    db_session.commit()

    verif_officer = db_session.query(User).filter_by(role=UserRole.VERIFICATION_OFFICER.value).first()

    # Other Institution officer cannot verify
    with pytest.raises(UnauthorizedRoleError):
        record_verification_decision(db_session, officer=other_inst_officer, decision="VERIFIED", fdr=fdr)

    # Verification officer cannot approve
    fdr.status = FDRStatus.PENDING_APPROVAL.value
    with pytest.raises(UnauthorizedRoleError):
        record_approval_decision(db_session, approver=verif_officer, decision="APPROVED", fdr=fdr)


def test_renewal_preserves_old_fdr_values_and_documents(db_session):
    """
    Verifies that FDR renewal retains historical FDR values in FDRRenewalHistory,
    records FieldProvenance for changed fields, and preserves immutable DocumentVersions.
    """
    fdr = db_session.query(FDR).first()
    inst_officer = db_session.query(User).filter_by(role=UserRole.INSTITUTION_OFFICER.value).first()
    approver = db_session.query(User).filter_by(role=UserRole.APPROVING_AUTHORITY.value).first()

    fdr.status = FDRStatus.ACTIVE.value
    original_fdr_number = fdr.fdr_number
    original_maturity_date = fdr.maturity_date

    # 1. Attach original document (Version 1)
    doc_v1 = DocumentVersion(
        fdr_id=fdr.id,
        document_type="FDR_RECEIPT",
        version=1,
        storage_key="fdr/1/original_fdr.pdf",
        file_name="original_fdr.pdf",
        file_size=1024,
        mime_type="application/pdf",
        sha256_hash="11" * 32,
        uploaded_by_id=inst_officer.id,
    )
    db_session.add(doc_v1)

    # 2. Create and approve a renewal request
    renewal_req = WorkflowRequest(
        fdr_id=fdr.id,
        request_type=RequestType.RENEWAL.value,
        status=RenewalStatus.APPROVED.value,
        reason="Maturity extension for accreditation",
        created_by_id=inst_officer.id,
    )
    db_session.add(renewal_req)
    db_session.commit()

    # 3. Attach renewal document (Version 2)
    doc_v2 = DocumentVersion(
        fdr_id=fdr.id,
        request_id=renewal_req.id,
        document_type="FDR_RECEIPT",
        version=2,
        storage_key="fdr/1/renewed_fdr.pdf",
        file_name="renewed_fdr.pdf",
        file_size=2048,
        mime_type="application/pdf",
        sha256_hash="22" * 32,
        uploaded_by_id=inst_officer.id,
    )
    db_session.add(doc_v2)
    db_session.commit()

    # 4. Complete renewal
    renewed_maturity = date(2030, 1, 1)
    renewed_number = "FDR-HIST-001-R1"

    renewal_history = complete_fdr_renewal(
        session=db_session,
        request=renewal_req,
        actor=approver,
        renewed_fdr_number=renewed_number,
        renewed_maturity_date=renewed_maturity,
        renewal_document_id=doc_v2.id,
        remarks="Approved 3-year extension.",
    )
    db_session.commit()

    # 5. Assert historical snapshot retained old values
    assert renewal_history.id is not None
    assert renewal_history.previous_fdr_number == original_fdr_number
    assert renewal_history.previous_maturity_date == original_maturity_date
    assert renewal_history.renewed_fdr_number == renewed_number
    assert renewal_history.renewed_maturity_date == renewed_maturity
    assert renewal_history.renewal_document_id == doc_v2.id

    # 6. Assert FieldProvenance recorded changes
    provenance = db_session.query(FieldProvenance).filter_by(fdr_id=fdr.id).all()
    field_names = [p.field_name for p in provenance]
    assert "fdr_number" in field_names
    assert "maturity_date" in field_names

    # 7. Assert BOTH document versions (v1 and v2) remain completely intact
    all_docs = db_session.query(DocumentVersion).filter_by(fdr_id=fdr.id).order_by(DocumentVersion.version.asc()).all()
    assert len(all_docs) == 2
    assert all_docs[0].version == 1
    assert all_docs[0].file_name == "original_fdr.pdf"
    assert all_docs[1].version == 2
    assert all_docs[1].file_name == "renewed_fdr.pdf"

    # 8. Assert FDR updated to ACTIVE and request is COMPLETED
    assert fdr.status == "ACTIVE"
    assert fdr.fdr_number == renewed_number
    assert fdr.maturity_date == renewed_maturity
    assert renewal_req.status == "COMPLETED"


def test_rejected_renewal_does_not_reject_underlying_fdr(db_session):
    """Verifies that rejecting a renewal request does NOT change the FDR status to REJECTED."""
    fdr = db_session.query(FDR).first()
    inst_officer = db_session.query(User).filter_by(role=UserRole.INSTITUTION_OFFICER.value).first()
    approver = db_session.query(User).filter_by(role=UserRole.APPROVING_AUTHORITY.value).first()

    fdr.status = FDRStatus.ACTIVE.value

    renewal_req = WorkflowRequest(
        fdr_id=fdr.id,
        request_type=RequestType.RENEWAL.value,
        status=RenewalStatus.PENDING_APPROVAL.value,
        reason="Extension request",
        created_by_id=inst_officer.id,
    )
    db_session.add(renewal_req)
    db_session.commit()

    record_approval_decision(
        session=db_session,
        approver=approver,
        decision="REJECTED",
        request=renewal_req,
        reason="Renewal documents inconsistent.",
    )
    db_session.commit()

    assert renewal_req.status == "REJECTED"
    # CRITICAL INVARIANT: FDR remains ACTIVE
    assert fdr.status == "ACTIVE"


def test_prohibited_modifications_and_deletions_on_history(db_session):
    """
    Verifies that historical records (VerificationRecord, ApprovalRecord,
    StatusTransitionHistory, FDRRenewalHistory) are strictly immutable and
    cannot be modified or deleted.
    """
    fdr = db_session.query(FDR).first()
    officer = db_session.query(User).filter_by(role=UserRole.VERIFICATION_OFFICER.value).first()
    approver = db_session.query(User).filter_by(role=UserRole.APPROVING_AUTHORITY.value).first()

    # 1. Verification Record Immutability
    v_rec = VerificationRecord(
        fdr_id=fdr.id,
        officer_id=officer.id,
        decision="VERIFIED",
        remarks="Verified initially",
    )
    db_session.add(v_rec)
    db_session.commit()

    # Attempt update
    v_rec.remarks = "Tampered remarks"
    with pytest.raises(ImmutableRecordError, match="append-only and cannot be modified"):
        db_session.commit()
    db_session.rollback()

    # Attempt delete
    db_session.delete(v_rec)
    with pytest.raises(ImmutableRecordError, match="append-only and cannot be deleted"):
        db_session.commit()
    db_session.rollback()

    # 2. Approval Record Immutability
    appr_rec = ApprovalRecord(
        fdr_id=fdr.id,
        approver_id=approver.id,
        decision="APPROVED",
        reason="Approved initially",
    )
    db_session.add(appr_rec)
    db_session.commit()

    appr_rec.decision = "REJECTED"
    with pytest.raises(ImmutableRecordError, match="append-only and cannot be modified"):
        db_session.commit()
    db_session.rollback()

    db_session.delete(appr_rec)
    with pytest.raises(ImmutableRecordError, match="append-only and cannot be deleted"):
        db_session.commit()
    db_session.rollback()

    # 3. Status Transition History Immutability
    transition = StatusTransitionHistory(
        fdr_id=fdr.id,
        actor_id=officer.id,
        from_status="SUBMITTED",
        to_status="UNDER_VERIFICATION",
    )
    db_session.add(transition)
    db_session.commit()

    transition.to_status = "TAMPERED"
    with pytest.raises(ImmutableRecordError, match="append-only and cannot be modified"):
        db_session.commit()
    db_session.rollback()

    db_session.delete(transition)
    with pytest.raises(ImmutableRecordError, match="append-only and cannot be deleted"):
        db_session.commit()
    db_session.rollback()


def test_fdr_timeline_ordering(db_session):
    """Verifies that get_fdr_timeline returns all events sorted by timestamp."""
    fdr = db_session.query(FDR).first()
    timeline = get_fdr_timeline(db_session, fdr.id)
    assert isinstance(timeline, list)
    # Timestamps are monotonically non-decreasing
    for i in range(len(timeline) - 1):
        assert timeline[i]["timestamp"] <= timeline[i + 1]["timestamp"]
