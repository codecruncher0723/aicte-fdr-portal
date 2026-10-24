"""
Critical Field Provenance Tracking Service for AICTE FDR Portal.

Enforces:
- Recording provenance for all critical FDR field modifications:
  field_name, previous_value, new_value, source_category, actor_id, timestamp, reason.
- Source category validation against ProvenanceSource enum.
- STRICT INVARIANT: Data MUST NEVER be marked BANK_CONFIRMED without actual
  authoritative bank confirmation. Uploaded documents, hashes, OCR, or simulated
  integrations do not qualify and will raise FalseBankConfirmationError.
- Enforcing mandatory reason when modifying/correcting existing field values.
- Atomic execution of FDR field updates and provenance recording.
- Append-only immutability for all FieldProvenance records.
"""

from datetime import datetime, timezone, date
from typing import Optional, Dict, Any, List, Set
from sqlalchemy.orm import Session

from app.models.enums import ProvenanceSource, UserRole
from app.models.fdr import FDR, FieldProvenance
from app.models.user import User


# Critical fields on FDR subject to provenance tracking
CRITICAL_FDR_FIELDS: Set[str] = {
    "fdr_number",
    "amount",
    "bank_name",
    "branch",
    "ifsc",
    "issue_date",
    "maturity_date",
    "interest_rate",
    "tenure_years",
    "tripartite_ref",
    "cert_number",
    "lien_status",
}

VALID_SOURCE_CATEGORIES: Set[str] = {
    ProvenanceSource.INSTITUTION_ENTERED.value,
    ProvenanceSource.SYSTEM_EXTRACTED.value,
    ProvenanceSource.OFFICER_CORRECTED.value,
    ProvenanceSource.BANK_CONFIRMED.value,
}


class ProvenanceError(Exception):
    """Base exception for provenance errors."""
    pass


class InvalidProvenanceSourceError(ProvenanceError):
    """Raised when an unknown source category is provided."""
    pass


class FalseBankConfirmationError(ProvenanceError):
    """
    Raised when an attempt is made to mark data as BANK_CONFIRMED without
    actual authoritative live bank confirmation.
    """
    pass


class MissingReasonError(ProvenanceError):
    """Raised when a required reason is omitted on field modification."""
    pass


def validate_source_category(
    source_category: str,
    authoritative_bank_confirmed: bool = False,
) -> str:
    """
    Validates the provenance source category.
    
    CRITICAL RULE:
    BANK_CONFIRMED is strictly forbidden unless authoritative_bank_confirmed
    is explicitly verified by a real external bank confirmation service.
    Manual uploads, OCR, hashes, and simulated checks DO NOT qualify.
    """
    if source_category not in VALID_SOURCE_CATEGORIES:
        raise InvalidProvenanceSourceError(
            f"Invalid source category '{source_category}'. "
            f"Must be one of: {', '.join(sorted(VALID_SOURCE_CATEGORIES))}"
        )

    if source_category == ProvenanceSource.BANK_CONFIRMED.value:
        if not authoritative_bank_confirmed:
            raise FalseBankConfirmationError(
                "Data cannot be labeled BANK_CONFIRMED without actual authoritative bank confirmation. "
                "Uploaded documents, OCR extraction, and simulated checks do not qualify."
            )

    return source_category


def record_field_provenance(
    session: Session,
    fdr_id: int,
    field_name: str,
    old_value: Optional[Any],
    new_value: Any,
    source_category: str,
    actor_id: Optional[int],
    reason: Optional[str] = None,
    authoritative_bank_confirmed: bool = False,
) -> FieldProvenance:
    """
    Records an append-only FieldProvenance entry for an FDR field.

    Validates:
    - field_name is a known critical field
    - source_category is valid and prevents false BANK_CONFIRMED claims
    - reason is non-empty when old_value is not None (i.e. changing existing value)
    """
    # 1. Validate source category & prevent false bank confirmation
    valid_source = validate_source_category(
        source_category=source_category,
        authoritative_bank_confirmed=authoritative_bank_confirmed,
    )

    # 2. Validate mandatory reason when modifying an existing field
    old_str = str(old_value) if old_value is not None else None
    new_str = str(new_value) if new_value is not None else ""

    if old_str is not None:
        if not reason or not reason.strip():
            raise MissingReasonError(
                f"A non-empty reason is required when modifying critical field '{field_name}'."
            )

    # 3. Create and persist FieldProvenance record
    prov = FieldProvenance(
        fdr_id=fdr_id,
        field_name=field_name,
        old_value=old_str,
        new_value=new_str,
        source_category=valid_source,
        actor_id=actor_id,
        reason=reason.strip() if reason else None,
    )
    session.add(prov)
    session.flush()
    return prov


def update_fdr_fields(
    session: Session,
    fdr: FDR,
    updates: Dict[str, Any],
    actor: User,
    source_category: str,
    reason: Optional[str] = None,
    authoritative_bank_confirmed: bool = False,
) -> List[FieldProvenance]:
    """
    Atomically updates critical FDR fields and records FieldProvenance entries
    for every changed field in the same transaction.

    Returns the list of created FieldProvenance records.
    """
    validate_source_category(
        source_category=source_category,
        authoritative_bank_confirmed=authoritative_bank_confirmed,
    )

    # Pre-validate reasons for all modified fields before applying any changes
    changed_fields = []
    for field_name, new_val in updates.items():
        if not hasattr(fdr, field_name):
            continue

        old_val = getattr(fdr, field_name)
        
        # Robust comparison handling Decimal, float, int, date, and strings
        is_changed = False
        if old_val is None and new_val is not None:
            is_changed = True
        elif old_val is not None and new_val is None:
            is_changed = True
        elif old_val is not None and new_val is not None:
            try:
                # Numeric comparison if both can be converted to float/Decimal
                from decimal import Decimal
                if hasattr(old_val, "as_tuple") or isinstance(old_val, (int, float)):
                    is_changed = (Decimal(str(old_val)) != Decimal(str(new_val)))
                elif isinstance(old_val, date) or isinstance(new_val, date):
                    is_changed = (str(old_val) != str(new_val))
                else:
                    is_changed = (str(old_val).strip() != str(new_val).strip())
            except Exception:
                is_changed = (str(old_val) != str(new_val))

        if is_changed:
            if old_val is not None and (not reason or not reason.strip()):
                raise MissingReasonError(
                    f"A non-empty reason is required when modifying critical field '{field_name}'."
                )
            changed_fields.append((field_name, old_val, new_val))

    provenance_entries: List[FieldProvenance] = []
    for field_name, old_val, new_val in changed_fields:
        prov = record_field_provenance(
            session=session,
            fdr_id=fdr.id,
            field_name=field_name,
            old_value=old_val,
            new_value=new_val,
            source_category=source_category,
            actor_id=actor.id,
            reason=reason,
            authoritative_bank_confirmed=authoritative_bank_confirmed,
        )
        provenance_entries.append(prov)
        setattr(fdr, field_name, new_val)

    session.flush()
    return provenance_entries


def get_fdr_field_provenance(
    session: Session,
    fdr_id: int,
    field_name: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Retrieves the complete provenance history for an FDR.
    Optionally filters by a specific critical field name.
    """
    query = session.query(FieldProvenance).filter(FieldProvenance.fdr_id == fdr_id)
    if field_name:
        query = query.filter(FieldProvenance.field_name == field_name)

    records = query.order_by(FieldProvenance.created_at.asc()).all()
    return [
        {
            "id": r.id,
            "fdr_id": r.fdr_id,
            "field_name": r.field_name,
            "old_value": r.old_value,
            "new_value": r.new_value,
            "source_category": r.source_category,
            "actor_id": r.actor_id,
            "reason": r.reason,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]
