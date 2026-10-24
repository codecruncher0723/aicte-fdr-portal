"""
FDR Records API Router (/api/v1/fdrs).
Implements Section 8.3 of REQUIREMENTS_UPDATED.md with strict server-side RBAC and institution isolation.
"""

from typing import List, Optional, Dict, Any
from datetime import date
from pydantic import BaseModel, Field, ConfigDict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.enums import UserRole, FDRStatus, ProvenanceSource
from app.models.institution import Institution
from app.models.user import User
from app.models.fdr import FDR, FieldProvenance
from app.models.audit import AuditLog
from app.auth import (
    get_current_user,
    require_roles,
    enforce_institution_isolation,
    derive_institution_id,
    enforce_separation_of_duties,
)
from app.history import record_status_transition

router = APIRouter(prefix="/api/v1/fdrs", tags=["FDR Records"])


class FDRCreateRequest(BaseModel):
    fdr_number: str = Field(..., min_length=1)
    cert_number: Optional[str] = None
    tripartite_ref: Optional[str] = None
    bank_name: str = Field(..., min_length=1)
    branch: str = Field(..., min_length=1)
    ifsc: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    interest_rate: Optional[str] = None
    issue_date: date
    maturity_date: date
    tenure_years: Optional[int] = 5
    auto_rollover: bool = False
    lien_status: Optional[str] = "Statutory Lien Registered"
    mandate_clause: Optional[str] = None
    notes: Optional[str] = None


class FDRResponse(BaseModel):
    id: int
    fdr_number: str
    cert_number: Optional[str] = None
    tripartite_ref: Optional[str] = None
    institution_id: int
    institution_name: Optional[str] = None
    bank_name: str
    branch: str
    ifsc: str
    amount: float
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


class StatusTransitionRequest(BaseModel):
    remarks: Optional[str] = None


@router.get("", summary="List FDR records scoped by role and institution")
def list_fdrs(
    status_filter: Optional[str] = Query(None, alias="status"),
    institution_id: Optional[int] = Query(None),
    issuing_bank: Optional[str] = Query(None),
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
    if status_filter:
        query = query.filter(FDR.status == status_filter)
    if issuing_bank:
        query = query.filter(FDR.bank_name.ilike(f"%{issuing_bank}%"))
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
                "fdr_number": f.fdr_number,
                "cert_number": f.cert_number,
                "tripartite_ref": f.tripartite_ref,
                "institution_id": f.institution_id,
                "institution_name": f.institution.name if f.institution else None,
                "bank_name": f.bank_name,
                "branch": f.branch,
                "ifsc": f.ifsc,
                "amount": float(f.amount),
                "interest_rate": f.interest_rate,
                "issue_date": f.issue_date,
                "maturity_date": f.maturity_date,
                "status": f.status,
                "lien_status": f.lien_status,
                "auto_rollover": f.auto_rollover,
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
        "fdr_number": fdr.fdr_number,
        "cert_number": fdr.cert_number,
        "tripartite_ref": fdr.tripartite_ref,
        "institution_id": fdr.institution_id,
        "institution_name": fdr.institution.name if fdr.institution else None,
        "bank_name": fdr.bank_name,
        "branch": fdr.branch,
        "ifsc": fdr.ifsc,
        "amount": float(fdr.amount),
        "interest_rate": fdr.interest_rate,
        "issue_date": fdr.issue_date,
        "maturity_date": fdr.maturity_date,
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
    if req.maturity_date < req.issue_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maturity date cannot be earlier than issue date.",
        )

    inst_id = derive_institution_id(current_user)

    fdr = FDR(
        institution_id=inst_id,
        fdr_number=req.fdr_number,
        cert_number=req.cert_number,
        tripartite_ref=req.tripartite_ref,
        bank_name=req.bank_name,
        branch=req.branch,
        ifsc=req.ifsc,
        amount=req.amount,
        interest_rate=req.interest_rate,
        issue_date=req.issue_date,
        maturity_date=req.maturity_date,
        tenure_years=req.tenure_years,
        auto_rollover=req.auto_rollover,
        lien_status=req.lien_status,
        mandate_clause=req.mandate_clause,
        notes=req.notes,
        status=FDRStatus.DRAFT.value,
        created_by_id=current_user.id,
    )
    session.add(fdr)
    session.flush()

    # Provenance
    prov = FieldProvenance(
        fdr_id=fdr.id,
        field_name="fdr_number",
        old_value=None,
        new_value=fdr.fdr_number,
        source_category=ProvenanceSource.INSTITUTION_ENTERED.value,
        actor_id=current_user.id,
        reason="Initial draft registration",
    )
    session.add(prov)
    session.commit()

    return {"fdr_id": fdr.id, "status": fdr.status}


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

    remarks = req.remarks if req else "Submitted for verification."
    record_status_transition(
        session=session,
        fdr=fdr,
        to_status=FDRStatus.SUBMITTED.value,
        actor=current_user,
        reason=remarks,
        transition_type="FDR_LIFECYCLE",
    )
    session.commit()
    return {"fdr_id": fdr.id, "status": fdr.status}


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
