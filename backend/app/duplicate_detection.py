"""
Configurable Duplicate FDR Candidate Detection Service.
Implements Section 2.1, Section 2.2, Section 11.3, and Section 10 of REQUIREMENTS_UPDATED.md:
- Detects possible duplicate FDR records within a configurable uniqueness scope.
- Uniqueness scope is TBD; DO NOT assume FDR number is globally unique.
- Flags candidates for review with discrepancy code DUPLICATE_FDR_CANDIDATE and severity REVIEW_REQUIRED.
- NEVER automatically rejects records or enforces a global DB uniqueness constraint.
- Deterministic, efficient, institution-aware, and testable.
"""

import enum
from typing import List, Dict, Any, Optional, Union
from decimal import Decimal
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.config import DUPLICATE_DETECTION_SCOPE
from app.models.enums import FDRStatus, DiscrepancySeverity, DiscrepancyCode
from app.models.fdr import FDR


class DuplicateScope(str, enum.Enum):
    INSTITUTION_AND_BANK_AND_NUMBER = "INSTITUTION_AND_BANK_AND_NUMBER"
    INSTITUTION_AND_NUMBER = "INSTITUTION_AND_NUMBER"
    CROSS_INSTITUTION_BANK_AND_NUMBER = "CROSS_INSTITUTION_BANK_AND_NUMBER"
    EXACT_MATCH = "EXACT_MATCH"
    GLOBAL_NUMBER = "GLOBAL_NUMBER"


SCOPE_ALIASES: Dict[str, str] = {
    "INSTITUTION_AND_BANK_AND_NUMBER": DuplicateScope.INSTITUTION_AND_BANK_AND_NUMBER.value,
    "ISSUER_AND_NUMBER_AND_INSTITUTION": DuplicateScope.INSTITUTION_AND_BANK_AND_NUMBER.value,
    "INSTITUTION_BANK_NUMBER": DuplicateScope.INSTITUTION_AND_BANK_AND_NUMBER.value,
    "DEFAULT": DuplicateScope.INSTITUTION_AND_BANK_AND_NUMBER.value,

    "INSTITUTION_AND_NUMBER": DuplicateScope.INSTITUTION_AND_NUMBER.value,
    "INSTITUTION_NUMBER": DuplicateScope.INSTITUTION_AND_NUMBER.value,

    "CROSS_INSTITUTION_BANK_AND_NUMBER": DuplicateScope.CROSS_INSTITUTION_BANK_AND_NUMBER.value,
    "GLOBAL_NUMBER_AND_BANK": DuplicateScope.CROSS_INSTITUTION_BANK_AND_NUMBER.value,
    "BANK_AND_NUMBER": DuplicateScope.CROSS_INSTITUTION_BANK_AND_NUMBER.value,
    "CROSS_INSTITUTION": DuplicateScope.CROSS_INSTITUTION_BANK_AND_NUMBER.value,

    "EXACT_MATCH": DuplicateScope.EXACT_MATCH.value,
    "EXACT": DuplicateScope.EXACT_MATCH.value,

    "GLOBAL_NUMBER": DuplicateScope.GLOBAL_NUMBER.value,
    "GLOBAL": DuplicateScope.GLOBAL_NUMBER.value,
    "ALL": DuplicateScope.GLOBAL_NUMBER.value,
}


def resolve_scope(scope: Optional[str] = None) -> str:
    """
    Resolves the duplicate detection scope from parameter or application configuration.
    Validates against supported scopes and aliases.
    """
    raw_scope = scope if (scope and scope.strip()) else DUPLICATE_DETECTION_SCOPE
    cleaned = raw_scope.strip().upper().replace("-", "_")

    if cleaned in SCOPE_ALIASES:
        return SCOPE_ALIASES[cleaned]

    supported = sorted(list(set(SCOPE_ALIASES.values())))
    raise ValueError(
        f"Invalid duplicate detection scope: '{raw_scope}'. "
        f"Supported scopes are: {', '.join(supported)}"
    )


def find_duplicate_candidates(
    session: Session,
    fdr: Union[FDR, Dict[str, Any]],
    exclude_fdr_id: Optional[int] = None,
    scope: Optional[str] = None,
    include_rejected: bool = False,
) -> List[Dict[str, Any]]:
    """
    Finds potential duplicate FDR records matching the given record under the configured scope.
    
    Returns candidate metadata without rejecting the target FDR or enforcing uniqueness.
    """
    effective_scope = resolve_scope(scope)

    # 1. Extract comparison fields
    fdr_number = str(
        fdr.fdr_number if hasattr(fdr, "fdr_number") else fdr.get("fdr_number", "")
    ).strip()
    
    inst_id = (
        fdr.institution_id if hasattr(fdr, "institution_id") else fdr.get("institution_id")
    )
    
    bank_name = str(
        fdr.bank_name if hasattr(fdr, "bank_name")
        else (fdr.get("bank_name") or fdr.get("issuing_bank", ""))
    ).strip()

    raw_amount = (
        fdr.amount if hasattr(fdr, "amount")
        else (fdr.get("amount") if fdr.get("amount") is not None else fdr.get("deposit_amount"))
    )
    target_amount = Decimal(str(raw_amount)) if raw_amount is not None else None

    raw_issue = (
        fdr.issue_date if hasattr(fdr, "issue_date") else fdr.get("issue_date")
    )
    target_issue = raw_issue if isinstance(raw_issue, date) else (
        date.fromisoformat(str(raw_issue)) if raw_issue else None
    )

    current_id = getattr(fdr, "id", None) or exclude_fdr_id

    if not fdr_number:
        return []

    # 2. Build Query
    query = session.query(FDR)

    # Never match record against itself
    if current_id:
        query = query.filter(FDR.id != current_id)

    # Exclude REJECTED records by default unless requested
    if not include_rejected:
        query = query.filter(FDR.status != FDRStatus.REJECTED.value)

    # Match normalized FDR number
    query = query.filter(func.trim(FDR.fdr_number) == fdr_number)

    # Scope-dependent criteria
    if effective_scope == DuplicateScope.INSTITUTION_AND_BANK_AND_NUMBER.value:
        if inst_id is not None:
            query = query.filter(FDR.institution_id == inst_id)
        if bank_name:
            query = query.filter(func.lower(func.trim(FDR.bank_name)) == bank_name.lower())

    elif effective_scope == DuplicateScope.INSTITUTION_AND_NUMBER.value:
        if inst_id is not None:
            query = query.filter(FDR.institution_id == inst_id)

    elif effective_scope == DuplicateScope.CROSS_INSTITUTION_BANK_AND_NUMBER.value:
        if bank_name:
            query = query.filter(func.lower(func.trim(FDR.bank_name)) == bank_name.lower())

    elif effective_scope == DuplicateScope.EXACT_MATCH.value:
        if inst_id is not None:
            query = query.filter(FDR.institution_id == inst_id)
        if bank_name:
            query = query.filter(func.lower(func.trim(FDR.bank_name)) == bank_name.lower())
        if target_issue is not None:
            query = query.filter(FDR.issue_date == target_issue)
        if target_amount is not None:
            query = query.filter(FDR.amount == target_amount)

    elif effective_scope == DuplicateScope.GLOBAL_NUMBER.value:
        # Number match only across all records
        pass

    results = query.order_by(FDR.id.asc()).all()

    # 3. Format candidate results with match reasons
    candidates: List[Dict[str, Any]] = []
    for cand in results:
        reasons: List[str] = [f"Matching FDR number '{cand.fdr_number}'"]
        
        if inst_id is not None and cand.institution_id == inst_id:
            reasons.append(f"Same institution (ID: {inst_id})")
        elif inst_id is not None and cand.institution_id != inst_id:
            reasons.append(f"Cross-institution record (Institution ID: {cand.institution_id})")

        if bank_name and cand.bank_name.strip().lower() == bank_name.lower():
            reasons.append(f"Matching issuing bank '{cand.bank_name}'")

        if target_amount is not None and cand.amount == target_amount:
            reasons.append(f"Matching deposit amount ₹{float(cand.amount):,.2f}")

        if target_issue is not None and cand.issue_date == target_issue:
            reasons.append(f"Matching issue date {cand.issue_date.isoformat()}")

        candidates.append({
            "id": cand.id,
            "fdr_number": cand.fdr_number,
            "institution_id": cand.institution_id,
            "institution_name": cand.institution.name if cand.institution else None,
            "bank_name": cand.bank_name,
            "branch": cand.branch,
            "amount": float(cand.amount),
            "status": cand.status,
            "issue_date": cand.issue_date.isoformat() if cand.issue_date else None,
            "maturity_date": cand.maturity_date.isoformat() if cand.maturity_date else None,
            "match_reasons": reasons,
            "is_cross_institution": bool(inst_id is not None and cand.institution_id != inst_id),
        })

    return candidates


def build_duplicate_discrepancy(
    candidates: List[Dict[str, Any]],
    scope: str,
) -> Optional[Dict[str, Any]]:
    """
    Constructs the canonical discrepancy payload if duplicate candidates exist.
    Follows Section 2.2 and Section 11.3:
    - Code: DUPLICATE_FDR_CANDIDATE
    - Severity: REVIEW_REQUIRED (Never automatic rejection; human verification required)
    """
    if not candidates:
        return None

    count = len(candidates)
    return {
        "code": DiscrepancyCode.DUPLICATE_FDR_CANDIDATE.value,
        "severity": DiscrepancySeverity.REVIEW_REQUIRED.value,
        "message": (
            f"Possible duplicate FDR candidate detected: {count} existing record(s) "
            f"share matching parameters under scope '{scope}'."
        ),
        "candidate_ids": [c["id"] for c in candidates],
        "matching_criteria": scope,
    }


def check_fdr_duplicate_candidates(
    session: Session,
    fdr_or_id: Union[FDR, int, Dict[str, Any]],
    scope: Optional[str] = None,
    include_rejected: bool = False,
) -> Dict[str, Any]:
    """
    High-level helper to evaluate duplicate candidates for an FDR instance, ID, or dictionary.
    Returns complete candidate summary and discrepancy details.
    """
    effective_scope = resolve_scope(scope)

    if isinstance(fdr_or_id, int):
        fdr_record = session.query(FDR).filter_by(id=fdr_or_id).first()
        if not fdr_record:
            raise ValueError(f"FDR with ID {fdr_or_id} not found.")
        target = fdr_record
        fdr_id = fdr_record.id
    else:
        target = fdr_or_id
        fdr_id = getattr(target, "id", None) or (target.get("id") if isinstance(target, dict) else None)

    candidates = find_duplicate_candidates(
        session=session,
        fdr=target,
        exclude_fdr_id=fdr_id,
        scope=effective_scope,
        include_rejected=include_rejected,
    )

    discrepancy = build_duplicate_discrepancy(candidates, effective_scope)

    return {
        "fdr_id": fdr_id,
        "configured_scope": effective_scope,
        "has_candidates": len(candidates) > 0,
        "candidate_count": len(candidates),
        "discrepancy": discrepancy,
        "candidates": candidates,
    }
