import pytest
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.enums import UserRole, FDRStatus, RequestType, RenewalStatus, ProvenanceSource
from app.models.institution import Institution
from app.models.user import User
from app.models.fdr import FDR, FieldProvenance
from app.models.document import DocumentVersion
from app.models.workflow import WorkflowRequest
from app.provenance import (
    record_field_provenance,
    update_fdr_fields,
    get_fdr_field_provenance,
    validate_source_category,
    InvalidProvenanceSourceError,
    FalseBankConfirmationError,
    MissingReasonError,
)
from app.history import complete_fdr_renewal, ImmutableRecordError


@pytest.fixture
def db_session():
    """In-memory SQLite session with full schema initialized."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        inst = Institution(
            aicte_pid="1-77665544",
            name="Provenance Test Institute",
            region="sro",
            state="Tamil Nadu",
            city="Chennai",
            sponsoring_trust="Provenance Trust",
            status="Active",
        )
        session.add(inst)
        session.flush()

        inst_officer = User(
            email="inst_prov@history.edu",
            username="inst_prov",
            hashed_password="mock_password",
            full_name="Institution Submitter",
            role=UserRole.INSTITUTION_OFFICER.value,
            institution_id=inst.id,
        )
        verif_officer = User(
            email="verif_prov@aicte.gov.in",
            username="verif_prov",
            hashed_password="mock_password",
            full_name="Verification Officer",
            role=UserRole.VERIFICATION_OFFICER.value,
        )
        approver = User(
            email="approver_prov@aicte.gov.in",
            username="approver_prov",
            hashed_password="mock_password",
            full_name="Approving Authority",
            role=UserRole.APPROVING_AUTHORITY.value,
        )
        session.add_all([inst_officer, verif_officer, approver])
        session.flush()

        fdr = FDR(
            fdr_number="FDR-PROV-100",
            institution_id=inst.id,
            bank_name="Canara Bank",
            branch="Anna Salai",
            ifsc="CNRB0001234",
            amount=2500000.0,
            issue_date=date(2024, 1, 1),
            maturity_date=date(2027, 1, 1),
            interest_rate="7.5%",
            status=FDRStatus.SUBMITTED.value,
            created_by_id=inst_officer.id,
        )
        session.add(fdr)
        session.commit()

        yield session
    finally:
        session.close()


def test_record_critical_field_changes(db_session):
    """Verifies critical field changes record previous/new value, actor, source, and reason."""
    fdr = db_session.query(FDR).first()
    verif_officer = db_session.query(User).filter_by(role=UserRole.VERIFICATION_OFFICER.value).first()

    old_amount = fdr.amount
    new_amount = 3000000.0
    reason_text = "Corrected principal amount as per physical deposit certificate."

    provenance_list = update_fdr_fields(
        session=db_session,
        fdr=fdr,
        updates={"amount": new_amount, "branch": "Mount Road"},
        actor=verif_officer,
        source_category=ProvenanceSource.OFFICER_CORRECTED.value,
        reason=reason_text,
    )
    db_session.commit()

    assert len(provenance_list) == 2
    assert fdr.amount == new_amount
    assert fdr.branch == "Mount Road"

    # Check database persistence of provenance
    all_prov = get_fdr_field_provenance(db_session, fdr.id)
    assert len(all_prov) == 2

    amount_entry = next(p for p in all_prov if p["field_name"] == "amount")
    assert amount_entry["old_value"] == str(old_amount)
    assert amount_entry["new_value"] == str(new_amount)
    assert amount_entry["source_category"] == "OFFICER_CORRECTED"
    assert amount_entry["actor_id"] == verif_officer.id
    assert amount_entry["reason"] == reason_text


def test_missing_reason_rejected_on_field_modification(db_session):
    """Asserts that modifying an existing critical field without a reason is rejected."""
    fdr = db_session.query(FDR).first()
    verif_officer = db_session.query(User).filter_by(role=UserRole.VERIFICATION_OFFICER.value).first()

    # Attempt with None reason
    with pytest.raises(MissingReasonError, match="non-empty reason is required"):
        update_fdr_fields(
            session=db_session,
            fdr=fdr,
            updates={"amount": 4000000.0},
            actor=verif_officer,
            source_category=ProvenanceSource.OFFICER_CORRECTED.value,
            reason=None,
        )

    # Attempt with whitespace reason
    with pytest.raises(MissingReasonError, match="non-empty reason is required"):
        record_field_provenance(
            session=db_session,
            fdr_id=fdr.id,
            field_name="bank_name",
            old_value="Canara Bank",
            new_value="State Bank of India",
            source_category=ProvenanceSource.OFFICER_CORRECTED.value,
            actor_id=verif_officer.id,
            reason="   ",
        )


def test_false_bank_confirmation_strictly_prevented(db_session):
    """
    CRITICAL TEST: Asserts that labeling data as BANK_CONFIRMED without an
    actual authoritative bank confirmation integration is strictly forbidden.
    Manual uploads, OCR, and simulated integrations do NOT qualify.
    """
    fdr = db_session.query(FDR).first()
    verif_officer = db_session.query(User).filter_by(role=UserRole.VERIFICATION_OFFICER.value).first()

    # Case 1: update_fdr_fields with BANK_CONFIRMED and authoritative_bank_confirmed=False
    with pytest.raises(FalseBankConfirmationError, match="cannot be labeled BANK_CONFIRMED"):
        update_fdr_fields(
            session=db_session,
            fdr=fdr,
            updates={"amount": 2500000.0},
            actor=verif_officer,
            source_category=ProvenanceSource.BANK_CONFIRMED.value,
            reason="Verified against uploaded PDF scan.",
            authoritative_bank_confirmed=False,
        )

    # Case 2: record_field_provenance directly with BANK_CONFIRMED
    with pytest.raises(FalseBankConfirmationError, match="Uploaded documents, OCR extraction, and simulated checks do not qualify"):
        record_field_provenance(
            session=db_session,
            fdr_id=fdr.id,
            field_name="fdr_number",
            old_value="FDR-PROV-100",
            new_value="FDR-PROV-100",
            source_category="BANK_CONFIRMED",
            actor_id=verif_officer.id,
            reason="OCR matched document.",
            authoritative_bank_confirmed=False,
        )


def test_authoritative_bank_confirmation_allowed_only_when_verified(db_session):
    """Verifies BANK_CONFIRMED is permitted only when authoritative_bank_confirmed is True."""
    fdr = db_session.query(FDR).first()
    verif_officer = db_session.query(User).filter_by(role=UserRole.VERIFICATION_OFFICER.value).first()

    prov = record_field_provenance(
        session=db_session,
        fdr_id=fdr.id,
        field_name="fdr_number",
        old_value="FDR-PROV-100",
        new_value="FDR-PROV-100-AUTH",
        source_category=ProvenanceSource.BANK_CONFIRMED.value,
        actor_id=verif_officer.id,
        reason="Real-time API response from Core Banking System verified.",
        authoritative_bank_confirmed=True,
    )
    db_session.commit()

    assert prov.id is not None
    assert prov.source_category == "BANK_CONFIRMED"


def test_unsupported_source_category_rejected():
    """Asserts that non-canonical source categories are rejected."""
    with pytest.raises(InvalidProvenanceSourceError, match="Invalid source category"):
        validate_source_category("USER_GUESS")

    with pytest.raises(InvalidProvenanceSourceError, match="Invalid source category"):
        validate_source_category("MANUAL_UNVERIFIED")


def test_actor_and_source_attribution(db_session):
    """Verifies that different actors and valid source categories are correctly attributed."""
    fdr = db_session.query(FDR).first()
    inst_officer = db_session.query(User).filter_by(role=UserRole.INSTITUTION_OFFICER.value).first()
    verif_officer = db_session.query(User).filter_by(role=UserRole.VERIFICATION_OFFICER.value).first()

    # 1. Institution Entered update
    p1 = update_fdr_fields(
        session=db_session,
        fdr=fdr,
        updates={"cert_number": "CERT-2024-001"},
        actor=inst_officer,
        source_category=ProvenanceSource.INSTITUTION_ENTERED.value,
        reason="Added certificate registration number.",
    )

    # 2. Officer Corrected update
    p2 = update_fdr_fields(
        session=db_session,
        fdr=fdr,
        updates={"interest_rate": "7.8%"},
        actor=verif_officer,
        source_category=ProvenanceSource.OFFICER_CORRECTED.value,
        reason="Updated to match RBI approved rate schedule.",
    )
    db_session.commit()

    assert p1[0].actor_id == inst_officer.id
    assert p1[0].source_category == "INSTITUTION_ENTERED"
    assert p2[0].actor_id == verif_officer.id
    assert p2[0].source_category == "OFFICER_CORRECTED"


def test_renewal_provenance_integration(db_session):
    """Verifies that complete_fdr_renewal records FieldProvenance for renewed fields."""
    fdr = db_session.query(FDR).first()
    inst_officer = db_session.query(User).filter_by(role=UserRole.INSTITUTION_OFFICER.value).first()
    approver = db_session.query(User).filter_by(role=UserRole.APPROVING_AUTHORITY.value).first()

    # Setup approved renewal request
    fdr.status = FDRStatus.ACTIVE.value
    renewal_req = WorkflowRequest(
        fdr_id=fdr.id,
        request_type=RequestType.RENEWAL.value,
        status=RenewalStatus.APPROVED.value,
        reason="Maturity extension",
        created_by_id=inst_officer.id,
    )
    db_session.add(renewal_req)

    # Renewal document
    doc = DocumentVersion(
        fdr_id=fdr.id,
        request_id=renewal_req.id,
        document_type="FDR_RECEIPT",
        version=2,
        storage_key="fdr/1/renewed.pdf",
        file_name="renewed.pdf",
        file_size=2048,
        mime_type="application/pdf",
        sha256_hash="33" * 32,
        uploaded_by_id=inst_officer.id,
    )
    db_session.add(doc)
    db_session.commit()

    complete_fdr_renewal(
        session=db_session,
        request=renewal_req,
        actor=approver,
        renewed_fdr_number="FDR-PROV-100-RENEWED",
        renewed_maturity_date=date(2030, 1, 1),
        renewal_document_id=doc.id,
        remarks="Council approved 3-year extension.",
    )
    db_session.commit()

    # Query provenance
    prov_records = get_fdr_field_provenance(db_session, fdr.id)
    fields = {p["field_name"]: p for p in prov_records}

    assert "fdr_number" in fields
    assert fields["fdr_number"]["old_value"] == "FDR-PROV-100"
    assert fields["fdr_number"]["new_value"] == "FDR-PROV-100-RENEWED"
    assert fields["fdr_number"]["source_category"] == "OFFICER_CORRECTED"

    assert "maturity_date" in fields
    assert fields["maturity_date"]["old_value"] == str(date(2027, 1, 1))
    assert fields["maturity_date"]["new_value"] == str(date(2030, 1, 1))


def test_unchanged_fields_do_not_create_provenance(db_session):
    """Verifies that submitting unchanged field values does not produce spurious provenance."""
    fdr = db_session.query(FDR).first()
    inst_officer = db_session.query(User).filter_by(role=UserRole.INSTITUTION_OFFICER.value).first()

    prov_list = update_fdr_fields(
        session=db_session,
        fdr=fdr,
        updates={"amount": 2500000.0, "bank_name": "Canara Bank"},  # Same values
        actor=inst_officer,
        source_category=ProvenanceSource.INSTITUTION_ENTERED.value,
        reason="No changes",
    )
    db_session.commit()

    assert len(prov_list) == 0


def test_field_provenance_immutability(db_session):
    """Verifies that FieldProvenance records cannot be updated or deleted."""
    fdr = db_session.query(FDR).first()
    inst_officer = db_session.query(User).filter_by(role=UserRole.INSTITUTION_OFFICER.value).first()

    prov = record_field_provenance(
        session=db_session,
        fdr_id=fdr.id,
        field_name="branch",
        old_value="Anna Salai",
        new_value="Guindy",
        source_category=ProvenanceSource.INSTITUTION_ENTERED.value,
        actor_id=inst_officer.id,
        reason="Branch relocation",
    )
    db_session.commit()

    # Attempt modification
    prov.new_value = "TAMPERED"
    with pytest.raises(ImmutableRecordError, match="append-only and cannot be modified"):
        db_session.commit()
    db_session.rollback()

    # Attempt deletion
    db_session.delete(prov)
    with pytest.raises(ImmutableRecordError, match="append-only and cannot be deleted"):
        db_session.commit()
    db_session.rollback()
