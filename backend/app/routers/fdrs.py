"""
FDR Records API Router (/api/v1/fdrs).
Implements Section 8.3 of REQUIREMENTS_UPDATED.md with strict server-side RBAC and institution isolation.
"""

from typing import List, Optional, Dict, Any, Union
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.enums import UserRole, FDRStatus, ProvenanceSource
from app.models.institution import Institution
from app.models.user import User
from app.models.fdr import FDR, FieldProvenance
from app.models.document import DocumentVersion
from app.models.audit import AuditLog
from app.auth import (
    get_current_user,
    require_roles,
    enforce_institution_isolation,
    derive_institution_id,
    derive_creator_id,
    enforce_separation_of_duties,
)
from app.history import record_status_transition

router = APIRouter(prefix="/api/v1/fdrs", tags=["FDR Records"])


class FDRCreateRequest(BaseModel):
    fdr_number: str = Field(..., min_length=1)
    cert_number: Optional[str] = None
    tripartite_ref: Optional[str] = None
    bank_name: Optional[str] = None
    issuing_bank: Optional[str] = None
    branch: Optional[str] = None
    branch_name: Optional[str] = None
    ifsc: Optional[str] = None
    amount: Optional[float] = None
    deposit_amount: Optional[float] = None
    interest_rate: Optional[Union[str, float]] = None
    issue_date: date
    maturity_date: date
    tenure_years: Optional[int] = 5
    auto_rollover: bool = False
    lien_status: Optional[str] = "Statutory Lien Registered"
    mandate_clause: Optional[str] = None
    notes: Optional[str] = None
    # Client-supplied fields: safely ignored and overridden by authenticated principal
    institution_id: Optional[int] = None
    created_by: Optional[int] = None
    created_by_id: Optional[int] = None


class FDRResponse(BaseModel):
    id: int
    fdr_id: Optional[int] = None
    fdr_number: str
    cert_number: Optional[str] = None
    tripartite_ref: Optional[str] = None
    institution_id: int
    institution_name: Optional[str] = None
    bank_name: str
    issuing_bank: Optional[str] = None
    branch: str
    branch_name: Optional[str] = None
    ifsc: str
    amount: float
    deposit_amount: Optional[float] = None
    interest_rate: Optional[str] = None
    issue_date: date
    maturity_date: date
    tenure_years: Optional[int] = None
    auto_rollover: bool
    status: str
    lien_status: Optional[str] = None
    mandate_clause: Optional[str] = None
    notes: Optional[str] = None
    created_by_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class FDRUpdateRequest(BaseModel):
    fdr_number: Optional[str] = None
    cert_number: Optional[str] = None
    tripartite_ref: Optional[str] = None
    bank_name: Optional[str] = None
    issuing_bank: Optional[str] = None
    branch: Optional[str] = None
    branch_name: Optional[str] = None
    ifsc: Optional[str] = None
    amount: Optional[float] = None
    deposit_amount: Optional[float] = None
    interest_rate: Optional[Union[str, float]] = None
    issue_date: Optional[date] = None
    maturity_date: Optional[date] = None
    tenure_years: Optional[int] = None
    auto_rollover: Optional[bool] = None
    lien_status: Optional[str] = None
    mandate_clause: Optional[str] = None
    notes: Optional[str] = None
    reason: Optional[str] = "FDR draft update"
    # Tampering attempts safely ignored
    institution_id: Optional[int] = None
    created_by: Optional[int] = None
    created_by_id: Optional[int] = None


class StatusTransitionRequest(BaseModel):
    remarks: Optional[str] = None
    actor_id: Optional[int] = None
    institution_id: Optional[int] = None
    supporting_document_id: Optional[int] = None
    document_id: Optional[int] = None
    file_name: Optional[str] = None
    fileName: Optional[str] = None


@router.get("", summary="List FDR records scoped by role and institution")
def list_fdrs(
    status_param: Optional[str] = Query(None, alias="status"),
    status_filter: Optional[str] = Query(None, alias="status_filter"),
    institution_id: Optional[int] = Query(None),
    issuing_bank: Optional[str] = Query(None),
    maturity_from: Optional[date] = Query(None),
    maturity_to: Optional[date] = Query(None),
    amount_min: Optional[float] = Query(None),
    amount_max: Optional[float] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Returns FDR records scoped server-side by the authenticated user's role:
    - Institution Officers can view ONLY their own institution's FDRs.
    - AICTE Admin, Verifiers, and Approvers can view FDRs across all institutions.
    Query parameters: status, institution_id, issuing_bank, maturity_from, maturity_to,
    amount_min, amount_max, search, page, limit.
    """
    query = session.query(FDR)

    # 1. Enforce Institution Isolation
    if current_user.role == UserRole.INSTITUTION_OFFICER.value:
        if institution_id is not None and institution_id != current_user.institution_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: cannot query FDRs belonging to another institution.",
            )
        query = query.filter(FDR.institution_id == current_user.institution_id)
    else:
        if institution_id is not None:
            query = query.filter(FDR.institution_id == institution_id)

    # 2. Filters
    eff_status = status_param or status_filter
    if eff_status:
        query = query.filter(FDR.status == eff_status)
    if issuing_bank:
        query = query.filter(FDR.bank_name.ilike(f"%{issuing_bank}%"))
    if maturity_from:
        query = query.filter(FDR.maturity_date >= maturity_from)
    if maturity_to:
        query = query.filter(FDR.maturity_date <= maturity_to)
    if amount_min is not None:
        query = query.filter(FDR.amount >= amount_min)
    if amount_max is not None:
        query = query.filter(FDR.amount <= amount_max)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (FDR.fdr_number.ilike(search_filter))
            | (FDR.bank_name.ilike(search_filter))
            | (FDR.branch.ilike(search_filter))
        )

    total = query.count()
    items = query.order_by(desc(FDR.id)).offset((page - 1) * limit).limit(limit).all()

    return {
        "items": [
            {
                "id": f.id,
                "fdr_id": f.id,
                "fdr_number": f.fdr_number,
                "cert_number": f.cert_number,
                "tripartite_ref": f.tripartite_ref,
                "institution_id": f.institution_id,
                "institution_name": f.institution.name if f.institution else None,
                "bank_name": f.bank_name,
                "issuing_bank": f.bank_name,
                "branch": f.branch,
                "branch_name": f.branch,
                "ifsc": f.ifsc,
                "amount": float(f.amount),
                "deposit_amount": float(f.amount),
                "interest_rate": f.interest_rate,
                "issue_date": f.issue_date.isoformat() if isinstance(f.issue_date, date) else str(f.issue_date),
                "maturity_date": f.maturity_date.isoformat() if isinstance(f.maturity_date, date) else str(f.maturity_date),
                "tenure_years": f.tenure_years,
                "status": f.status,
                "lien_status": f.lien_status,
                "auto_rollover": f.auto_rollover,
                "created_by_id": f.created_by_id,
            }
            for f in items
        ],
        "page": page,
        "limit": limit,
        "total": total,
    }


@router.get("/{fdr_id}", summary="Get FDR detail with resource-level authorization")
def get_fdr(
    fdr_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Returns FDR detail. Enforces IDOR protection:
    Institution Officer attempting to view an FDR from another institution is denied with 403.
    """
    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR {fdr_id} not found.")

    enforce_institution_isolation(user=current_user, target_institution_id=fdr.institution_id)

    return {
        "id": fdr.id,
        "fdr_id": fdr.id,
        "fdr_number": fdr.fdr_number,
        "cert_number": fdr.cert_number,
        "tripartite_ref": fdr.tripartite_ref,
        "institution_id": fdr.institution_id,
        "institution_name": fdr.institution.name if fdr.institution else None,
        "bank_name": fdr.bank_name,
        "issuing_bank": fdr.bank_name,
        "branch": fdr.branch,
        "branch_name": fdr.branch,
        "ifsc": fdr.ifsc,
        "amount": float(fdr.amount),
        "deposit_amount": float(fdr.amount),
        "interest_rate": fdr.interest_rate,
        "issue_date": fdr.issue_date.isoformat() if isinstance(fdr.issue_date, date) else str(fdr.issue_date),
        "maturity_date": fdr.maturity_date.isoformat() if isinstance(fdr.maturity_date, date) else str(fdr.maturity_date),
        "tenure_years": fdr.tenure_years,
        "auto_rollover": fdr.auto_rollover,
        "status": fdr.status,
        "lien_status": fdr.lien_status,
        "mandate_clause": fdr.mandate_clause,
        "notes": fdr.notes,
        "created_by_id": fdr.created_by_id,
        "created_at": fdr.created_at.isoformat() if fdr.created_at else None,
    }


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create draft FDR record")
def create_fdr(
    req: FDRCreateRequest,
    current_user: User = Depends(require_roles(UserRole.INSTITUTION_OFFICER.value)),
    session: Session = Depends(get_db),
):
    """
    Creates a new draft FDR.
    Institution ID and created_by are derived strictly from the authenticated principal.
    Client-supplied institution ID is never trusted.
    """
    # 0. Validate FDR number
    if not req.fdr_number or not req.fdr_number.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FDR number is required and cannot be blank.",
        )

    # 1. Resolve and validate bank name
    resolved_bank = req.bank_name or req.issuing_bank
    if not resolved_bank or not resolved_bank.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bank name / issuing bank is required.",
        )

    # 2. Resolve branch
    resolved_branch = req.branch or req.branch_name or "Main Branch"

    # 3. Resolve and validate deposit amount
    resolved_amount = req.amount if req.amount is not None else req.deposit_amount
    if resolved_amount is None or resolved_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount / deposit amount must be positive.",
        )

    # 4. Validate dates
    if req.maturity_date < req.issue_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maturity date cannot be earlier than issue date.",
        )

    inst_id = derive_institution_id(current_user)
    creator_id = derive_creator_id(current_user)

    fdr = FDR(
        institution_id=inst_id,
        fdr_number=req.fdr_number.strip(),
        cert_number=req.cert_number.strip() if req.cert_number else None,
        tripartite_ref=req.tripartite_ref.strip() if req.tripartite_ref else None,
        bank_name=resolved_bank.strip(),
        branch=resolved_branch.strip(),
        ifsc=req.ifsc.strip() if req.ifsc else "N/A",
        amount=resolved_amount,
        interest_rate=str(req.interest_rate) if req.interest_rate is not None else None,
        issue_date=req.issue_date,
        maturity_date=req.maturity_date,
        tenure_years=req.tenure_years,
        auto_rollover=req.auto_rollover,
        lien_status=req.lien_status,
        mandate_clause=req.mandate_clause,
        notes=req.notes,
        status=FDRStatus.DRAFT.value,
        created_by_id=creator_id,
    )
    session.add(fdr)
    session.flush()

    # Initial provenance record
    prov = FieldProvenance(
        fdr_id=fdr.id,
        field_name="fdr_number",
        old_value=None,
        new_value=fdr.fdr_number,
        source_category=ProvenanceSource.INSTITUTION_ENTERED.value,
        actor_id=creator_id,
        reason="Initial draft registration",
    )
    session.add(prov)
    session.commit()

    return {
        "id": fdr.id,
        "fdr_id": fdr.id,
        "status": fdr.status,
    }


@router.patch("/{fdr_id}", summary="Update draft or correction-required FDR record")
def update_fdr(
    fdr_id: int,
    req: FDRUpdateRequest,
    current_user: User = Depends(require_roles(UserRole.INSTITUTION_OFFICER.value)),
    session: Session = Depends(get_db),
):
    """
    Updates an FDR record.
    Enforces resource-level authorization:
    - Target FDR must exist in database (404 if not found).
    - Owning Institution Officer only (403 if belongs to another institution).
    - Status check: only DRAFT or CORRECTION_REQUIRED can be updated (409 Conflict otherwise).
    - Provenance recorded for critical field updates with actor_id=current_user.id.
    """
    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR {fdr_id} not found.")

    enforce_institution_isolation(user=current_user, target_institution_id=fdr.institution_id)

    if fdr.status not in (FDRStatus.DRAFT.value, FDRStatus.CORRECTION_REQUIRED.value):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot edit FDR in '{fdr.status}' status. Only DRAFT or CORRECTION_REQUIRED records can be edited.",
        )

    # Date validation
    new_issue = req.issue_date or fdr.issue_date
    new_maturity = req.maturity_date or fdr.maturity_date
    if new_maturity < new_issue:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maturity date cannot be earlier than issue date.",
        )

    # Amount validation
    new_amount = req.amount if req.amount is not None else req.deposit_amount
    if new_amount is not None and new_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount must be positive.",
        )

    new_bank = req.bank_name or req.issuing_bank
    new_branch = req.branch or req.branch_name

    if new_bank is not None and not new_bank.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bank name cannot be blank.",
        )

    if req.fdr_number is not None and not req.fdr_number.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FDR number cannot be blank.",
        )

    # Check reason requirement if critical fields are modified
    critical_check = {
        "fdr_number": req.fdr_number,
        "bank_name": new_bank,
        "amount": new_amount,
        "issue_date": req.issue_date,
        "maturity_date": req.maturity_date,
    }
    has_critical_change = False
    for k, v in critical_check.items():
        if v is not None:
            curr_v = getattr(fdr, k)
            if k == "amount":
                if Decimal(str(curr_v)) != Decimal(str(v)):
                    has_critical_change = True
            elif str(curr_v) != str(v):
                has_critical_change = True

    if has_critical_change and (not req.reason or not req.reason.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A non-empty reason is required when modifying critical fields.",
        )

    reason_text = req.reason.strip() if req.reason else "Draft field modification"

    # Non-critical fields updates
    for field in ["cert_number", "tripartite_ref", "ifsc", "tenure_years", "auto_rollover", "lien_status", "mandate_clause", "notes"]:
        val = getattr(req, field)
        if val is not None:
            setattr(fdr, field, val)

    if req.interest_rate is not None:
        fdr.interest_rate = str(req.interest_rate)

    if new_branch is not None:
        fdr.branch = new_branch

    # Critical fields with provenance tracking
    if req.fdr_number is not None and req.fdr_number != fdr.fdr_number:
        old_val = fdr.fdr_number
        fdr.fdr_number = req.fdr_number
        session.add(
            FieldProvenance(
                fdr_id=fdr.id,
                field_name="fdr_number",
                old_value=str(old_val) if old_val is not None else None,
                new_value=str(req.fdr_number),
                source_category=ProvenanceSource.INSTITUTION_ENTERED.value,
                actor_id=current_user.id,
                reason=reason_text,
            )
        )

    if new_bank is not None and new_bank != fdr.bank_name:
        old_val = fdr.bank_name
        fdr.bank_name = new_bank
        session.add(
            FieldProvenance(
                fdr_id=fdr.id,
                field_name="bank_name",
                old_value=str(old_val) if old_val is not None else None,
                new_value=str(new_bank),
                source_category=ProvenanceSource.INSTITUTION_ENTERED.value,
                actor_id=current_user.id,
                reason=reason_text,
            )
        )

    if new_amount is not None:
        if Decimal(str(fdr.amount)) != Decimal(str(new_amount)):
            old_amount = fdr.amount
            fdr.amount = new_amount
            session.add(
                FieldProvenance(
                    fdr_id=fdr.id,
                    field_name="amount",
                    old_value=str(old_amount),
                    new_value=str(new_amount),
                    source_category=ProvenanceSource.INSTITUTION_ENTERED.value,
                    actor_id=current_user.id,
                    reason=reason_text,
                )
            )

    if req.issue_date is not None and req.issue_date != fdr.issue_date:
        old_issue = fdr.issue_date
        fdr.issue_date = req.issue_date
        session.add(
            FieldProvenance(
                fdr_id=fdr.id,
                field_name="issue_date",
                old_value=str(old_issue),
                new_value=str(req.issue_date),
                source_category=ProvenanceSource.INSTITUTION_ENTERED.value,
                actor_id=current_user.id,
                reason=reason_text,
            )
        )

    if req.maturity_date is not None and req.maturity_date != fdr.maturity_date:
        old_mat = fdr.maturity_date
        fdr.maturity_date = req.maturity_date
        session.add(
            FieldProvenance(
                fdr_id=fdr.id,
                field_name="maturity_date",
                old_value=str(old_mat),
                new_value=str(req.maturity_date),
                source_category=ProvenanceSource.INSTITUTION_ENTERED.value,
                actor_id=current_user.id,
                reason=reason_text,
            )
        )

    session.commit()
    return {
        "id": fdr.id,
        "fdr_id": fdr.id,
        "status": fdr.status,
    }


@router.post("/{fdr_id}/submit", summary="Submit draft FDR for regulatory verification")
def submit_fdr(
    fdr_id: int,
    req: Optional[StatusTransitionRequest] = None,
    current_user: User = Depends(require_roles(UserRole.INSTITUTION_OFFICER.value)),
    session: Session = Depends(get_db),
):
    """
    Submits FDR record for scrutiny. Only the owning Institution Officer can submit.
    FDR must be in DRAFT or CORRECTION_REQUIRED. Result is SUBMITTED.
    Enforces server-side institution isolation, field validation, and required uploaded supporting document.
    """
    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR {fdr_id} not found.")

    enforce_institution_isolation(user=current_user, target_institution_id=fdr.institution_id)

    if fdr.status not in (FDRStatus.DRAFT.value, FDRStatus.CORRECTION_REQUIRED.value):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot submit FDR in '{fdr.status}' status. Only DRAFT or CORRECTION_REQUIRED can be submitted.",
        )

    # 1. Validate required FDR number
    if not fdr.fdr_number or not fdr.fdr_number.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot submit FDR without a valid FDR number.",
        )

    # 2. Validate required bank name
    if not fdr.bank_name or not fdr.bank_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot submit FDR without a valid issuing bank name.",
        )

    # 3. Validate positive amount
    if fdr.amount is None or fdr.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot submit FDR with invalid deposit amount.",
        )

    # 4. Validate issue and maturity dates
    if not fdr.issue_date or not fdr.maturity_date or fdr.maturity_date < fdr.issue_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot submit FDR with invalid issue or maturity dates.",
        )

    # 5. Required Supporting Document Validation
    # A filename alone in payload or metadata does NOT qualify.
    # Must have an actual uploaded DocumentVersion record associated with this FDR.
    supporting_doc_id = None
    if req:
        supporting_doc_id = req.supporting_document_id or req.document_id

    if supporting_doc_id is not None:
        doc = session.query(DocumentVersion).filter_by(id=supporting_doc_id).first()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Supporting document with ID {supporting_doc_id} not found.",
            )
        if doc.fdr_id != fdr.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Supporting document with ID {supporting_doc_id} is not associated with FDR {fdr.id}.",
            )
        if doc.file_size <= 0 or not doc.sha256_hash or len(doc.sha256_hash) != 64:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Supporting document is invalid or corrupted.",
            )
    else:
        # Check that at least one valid uploaded document is linked to this FDR
        valid_doc = (
            session.query(DocumentVersion)
            .filter(
                DocumentVersion.fdr_id == fdr.id,
                DocumentVersion.file_size > 0,
                DocumentVersion.sha256_hash.isnot(None),
            )
            .first()
        )
        if not valid_doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot submit FDR without a valid uploaded supporting document. A filename alone does not qualify; upload a document first.",
            )

    remarks = req.remarks if (req and req.remarks and req.remarks.strip()) else "Submitted for verification."
    try:
        record_status_transition(
            session=session,
            fdr=fdr,
            to_status=FDRStatus.SUBMITTED.value,
            actor=current_user,
            reason=remarks.strip(),
            transition_type="FDR_LIFECYCLE",
        )
        session.commit()
    except Exception:
        session.rollback()
        raise

    return {
        "id": fdr.id,
        "fdr_id": fdr.id,
        "status": fdr.status,
    }


@router.post("/{fdr_id}/start-verification", summary="Claim submitted FDR into scrutiny review")
def start_verification(
    fdr_id: int,
    req: Optional[StatusTransitionRequest] = None,
    current_user: User = Depends(require_roles(UserRole.VERIFICATION_OFFICER.value, UserRole.AICTE_ADMIN.value)),
    session: Session = Depends(get_db),
):
    """
    Verification Officer takes the submitted FDR into review.
    Enforces separation of duties: Submitter cannot verify. Result is UNDER_VERIFICATION.
    """
    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR {fdr_id} not found.")

    enforce_separation_of_duties(actor=current_user, submitter_id=fdr.created_by_id, action="verify")

    if fdr.status != FDRStatus.SUBMITTED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot start verification from '{fdr.status}'. Status must be SUBMITTED.",
        )

    remarks = req.remarks if req else "Taking item into verification review."
    record_status_transition(
        session=session,
        fdr=fdr,
        to_status=FDRStatus.UNDER_VERIFICATION.value,
        actor=current_user,
        reason=remarks,
        transition_type="FDR_VERIFICATION",
    )
    session.commit()
    return {"fdr_id": fdr.id, "status": fdr.status}


@router.get("/{fdr_id}/audit-logs", summary="Get audit history for an FDR record")
def get_fdr_audit_logs(
    fdr_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Returns audit trail for an FDR record.
    Enforces institution isolation for Institution Officers.
    """
    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR {fdr_id} not found.")

    enforce_institution_isolation(user=current_user, target_institution_id=fdr.institution_id)

    logs = (
        session.query(AuditLog)
        .filter(AuditLog.target_type == "FDR", AuditLog.target_id == str(fdr_id))
        .order_by(desc(AuditLog.created_at))
        .all()
    )

    return [
        {
            "id": l.id,
            "action": l.action,
            "actor_id": l.actor_id,
            "actor_name": l.actor_name,
            "actor_role": l.actor_role,
            "details": l.details,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]
