"""
Workflow Verification & Approval Operations Router.
Enforces Section 8.3 of REQUIREMENTS_UPDATED.md:
- Role boundaries: Scrutiny/Verification is strictly reserved for VERIFICATION_OFFICER.
- Role boundaries: Final Approval is strictly reserved for APPROVING_AUTHORITY.
- Separation of duties: Submitter CANNOT verify or approve their own submission.
- Rejection of unauthenticated requests with 401 Unauthorized.
- Rejection of unauthorized roles with 403 Forbidden.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.enums import UserRole, FDRStatus
from app.models.fdr import FDR
from app.models.workflow import WorkflowRequest, VerificationRecord, ApprovalRecord
from app.models.user import User
from app.auth import (
    get_current_user,
    require_roles,
    enforce_separation_of_duties,
)
from app.history import (
    record_verification_decision,
    record_approval_decision,
    SeparationOfDutiesError,
    UnauthorizedRoleError,
)

router = APIRouter(prefix="/api/v1", tags=["Workflow Verification & Approval"])


class VerificationRequest(BaseModel):
    decision: str = Field(..., description="VERIFIED, CORRECTION_REQUIRED, or REJECTED")
    remarks: Optional[str] = Field(None, description="Officer verification remarks")
    discrepancy_code: Optional[str] = None
    discrepancy_severity: Optional[str] = None
    discrepancy_note: Optional[str] = None


class ApprovalRequest(BaseModel):
    decision: str = Field(..., description="APPROVED or REJECTED")
    remarks: Optional[str] = Field(None, description="Council approval or rejection remarks")
    council_order_ref: Optional[str] = None


@router.get("/verifications/pending", summary="List items pending scrutiny and verification")
def get_pending_verifications(
    current_user: User = Depends(require_roles(UserRole.VERIFICATION_OFFICER.value, UserRole.AICTE_ADMIN.value)),
    session: Session = Depends(get_db),
):
    """
    Returns pending verification queue.
    Only VERIFICATION_OFFICER and AICTE_ADMIN can access.
    """
    pending_fdrs = (
        session.query(FDR)
        .filter(FDR.status.in_([FDRStatus.SUBMITTED.value, FDRStatus.UNDER_VERIFICATION.value]))
        .all()
    )
    return [
        {
            "fdr_id": f.id,
            "fdr_number": f.fdr_number,
            "institution_id": f.institution_id,
            "institution_name": f.institution.name if f.institution else None,
            "amount": float(f.amount),
            "status": f.status,
            "created_by_id": f.created_by_id,
        }
        for f in pending_fdrs
    ]


@router.post("/fdrs/{fdr_id}/verify", summary="Record FDR verification decision")
def verify_fdr(
    fdr_id: int,
    req: VerificationRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Records initial FDR verification.
    Enforces:
    - Role check: Only VERIFICATION_OFFICER (or AICTE_ADMIN) can verify.
    - Approving Authority and Institution Officer are denied with 403 Forbidden.
    - Separation of duties: Submitter cannot verify their own submission.
    """
    # 1. Role enforcement
    if current_user.role not in (UserRole.VERIFICATION_OFFICER.value, UserRole.AICTE_ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: role '{current_user.role}' is not authorized to perform verification scrutiny.",
        )

    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR {fdr_id} not found.")

    # 2. Separation of duties
    enforce_separation_of_duties(actor=current_user, submitter_id=fdr.created_by_id, action="verify")

    try:
        v_rec = record_verification_decision(
            session=session,
            officer=current_user,
            decision=req.decision,
            fdr=fdr,
            remarks=req.remarks,
            discrepancy_code=req.discrepancy_code,
            discrepancy_severity=req.discrepancy_severity,
            discrepancy_note=req.discrepancy_note,
        )
        session.commit()
    except SeparationOfDutiesError as e:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except (UnauthorizedRoleError, ValueError) as e:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {
        "verification_id": v_rec.id,
        "fdr_id": fdr.id,
        "decision": v_rec.decision,
        "new_status": fdr.status,
    }


@router.post("/fdrs/{fdr_id}/approval", summary="Record FDR approval or rejection decision")
def approve_fdr(
    fdr_id: int,
    req: ApprovalRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Records initial FDR approval or rejection.
    Enforces:
    - Role check: Only APPROVING_AUTHORITY (or AICTE_ADMIN) can approve.
    - Verification Officer and Institution Officer are denied with 403 Forbidden.
    - Separation of duties: Submitter cannot approve their own submission.
    """
    # 1. Role enforcement
    if current_user.role not in (UserRole.APPROVING_AUTHORITY.value, UserRole.AICTE_ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: role '{current_user.role}' is not authorized to approve submissions.",
        )

    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR {fdr_id} not found.")

    # 2. Separation of duties
    enforce_separation_of_duties(actor=current_user, submitter_id=fdr.created_by_id, action="approve")

    try:
        a_rec = record_approval_decision(
            session=session,
            approver=current_user,
            decision=req.decision,
            fdr=fdr,
            council_order_ref=req.council_order_ref,
            reason=req.remarks,
        )
        session.commit()
    except SeparationOfDutiesError as e:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except (UnauthorizedRoleError, ValueError) as e:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {
        "approval_id": a_rec.id,
        "fdr_id": fdr.id,
        "decision": a_rec.decision,
        "new_status": fdr.status,
    }
