"""
Workflow Verification, Approval, Renewal & Release Operations Router.
Enforces Section 8.3, 8.5 & 8.6 of REQUIREMENTS_UPDATED.md:
- Role boundaries: Scrutiny/Verification is strictly reserved for VERIFICATION_OFFICER.
- Role boundaries: Final Approval is strictly reserved for APPROVING_AUTHORITY.
- Separation of duties: Submitter CANNOT verify or approve their own submission.
- Renewal creation, verification, approval, and transactional completion.
- Release creation, verification, approval, readiness staging, and disbursement confirmation.
- Status invariants: Readiness only from RELEASE_APPROVED; Confirmation only from AWAITING_CONFIRMATION.
- Rejection of unauthenticated requests with 401 Unauthorized.
- Rejection of unauthorized roles with 403 Forbidden.
- Discrepancy flagging: RENEWAL_DETAILS_DIFFER_FROM_CURRENT_RECORD.
"""

import json
from datetime import date, datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.enums import (
    UserRole,
    FDRStatus,
    RequestType,
    RenewalStatus,
    ReleaseStatus,
    DiscrepancyCode,
)
from app.models.fdr import FDR
from app.models.workflow import WorkflowRequest, VerificationRecord, ApprovalRecord
from app.models.document import DocumentVersion
from app.models.audit import AuditLog
from app.models.user import User
from app.auth import (
    get_current_user,
    require_roles,
    enforce_institution_isolation,
    enforce_separation_of_duties,
)
from app.history import (
    record_status_transition,
    record_verification_decision,
    record_approval_decision,
    complete_fdr_renewal,
    SeparationOfDutiesError,
    UnauthorizedRoleError,
    InvalidStatusTransitionError,
)

router = APIRouter(prefix="/api/v1", tags=["Workflow Verification, Approval & Requests"])


# =====================================================================
# Request Schemas
# =====================================================================

class VerificationRequest(BaseModel):
    decision: str = Field(..., description="VERIFIED, CORRECTION_REQUIRED, or REJECTED")
    remarks: Optional[str] = Field(None, description="Officer verification remarks")
    discrepancy_code: Optional[str] = None
    discrepancy_severity: Optional[str] = None
    discrepancy_note: Optional[str] = None
    officer_id: Optional[int] = None
    actor_id: Optional[int] = None
    document_version_id: Optional[int] = None


class ApprovalRequest(BaseModel):
    decision: str = Field(..., description="APPROVED or REJECTED")
    remarks: Optional[str] = Field(None, description="Council approval or rejection remarks")
    council_order_ref: Optional[str] = None
    approver_id: Optional[int] = None
    actor_id: Optional[int] = None
    document_version_id: Optional[int] = None


class RenewalCreateRequest(BaseModel):
    reason: str = Field(..., min_length=3, description="Justification for renewal")
    proposed_maturity_date: date = Field(..., description="Proposed new maturity date")
    proposed_fdr_number: Optional[str] = Field(None, description="Proposed new FDR certificate/receipt number")
    proposed_interest_rate: Optional[str] = Field(None, description="Proposed new interest rate (e.g. 7.25%)")
    supporting_document_id: Optional[int] = Field(None, description="Uploaded supporting document version ID")
    applicant_notes: Optional[str] = Field(None, description="Applicant notes/remarks")


class RenewalCompleteRequest(BaseModel):
    renewed_fdr_number: str = Field(..., min_length=1, description="Final renewed FDR number")
    renewed_maturity_date: date = Field(..., description="Final renewed maturity date")
    renewed_interest_rate: Optional[str] = Field(None, description="Final renewed interest rate")
    renewal_document_id: Optional[int] = Field(None, description="Uploaded renewed FDR document ID")
    remarks: Optional[str] = Field(None, description="Completion remarks")


class ReleaseCreateRequest(BaseModel):
    reason: str = Field(..., min_length=3, description="Statutory justification for release or refund")
    supporting_document_id: Optional[int] = Field(None, description="Uploaded governing body closure/surrender document ID")
    applicant_notes: Optional[str] = Field(None, description="Additional notes from applicant institution")


class ReleaseReadinessRequest(BaseModel):
    remarks: Optional[str] = Field(None, description="Readiness remarks confirming readiness for disbursement recording")


class ReleaseConfirmationRequest(BaseModel):
    confirmation_reference: str = Field(..., min_length=3, description="Bank voucher or UTR confirmation reference (e.g. UTR-SBI-2026-9901)")
    remarks: Optional[str] = Field(None, description="Disbursement confirmation remarks")
    voucher_document_id: Optional[int] = Field(None, description="Uploaded payment confirmation advice document ID")


class RequestResubmitRequest(BaseModel):
    remarks: Optional[str] = Field(None, description="Clarification / resubmission remarks")
    supporting_document_id: Optional[int] = Field(None, description="Amended document version ID")


class RequestCancelRequest(BaseModel):
    reason: str = Field(..., min_length=3, description="Cancellation reason")


def _extract_proposed_details(req_obj: WorkflowRequest) -> Dict[str, Any]:
    """Helper to parse proposed renewal details and compute discrepancy flags."""
    prop_details: Dict[str, Any] = {}
    if req_obj.applicant_notes:
        try:
            parsed = json.loads(req_obj.applicant_notes)
            if isinstance(parsed, dict) and "proposed_maturity_date" in parsed:
                prop_details = parsed
        except Exception:
            pass

    differ_flag = False
    if req_obj.fdr:
        cur_fdr = req_obj.fdr
        prop_fdr_num = prop_details.get("proposed_fdr_number") or cur_fdr.fdr_number
        prop_mat_date = prop_details.get("proposed_maturity_date") or (str(cur_fdr.maturity_date) if cur_fdr.maturity_date else None)
        prop_rate = prop_details.get("proposed_interest_rate") or cur_fdr.interest_rate

        if (
            (prop_fdr_num and prop_fdr_num != cur_fdr.fdr_number)
            or (prop_mat_date and str(prop_mat_date) != str(cur_fdr.maturity_date))
            or (prop_rate and prop_rate != cur_fdr.interest_rate)
        ):
            differ_flag = True

    return {
        "proposed_details": prop_details,
        "discrepancy_flags": [DiscrepancyCode.RENEWAL_DETAILS_DIFFER_FROM_CURRENT_RECORD.value] if differ_flag else [],
        "differ_flag": differ_flag,
    }


# =====================================================================
# Verification & Approval for Initial FDR Submissions
# =====================================================================

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
    Records scrutiny review decision for an FDR submission.
    """
    if current_user.role not in (UserRole.VERIFICATION_OFFICER.value, UserRole.AICTE_ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: role '{current_user.role}' is not authorized to perform verification.",
        )

    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR {fdr_id} not found.")

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
            document_version_id=req.document_version_id,
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
        "document_version_id": v_rec.document_version_id,
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
    """
    if current_user.role not in (UserRole.APPROVING_AUTHORITY.value, UserRole.AICTE_ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: role '{current_user.role}' is not authorized to approve submissions.",
        )

    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR {fdr_id} not found.")

    if req.decision == "REJECTED" and (not req.remarks or not req.remarks.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rejection decision requires a reason or remarks.",
        )

    enforce_separation_of_duties(actor=current_user, submitter_id=fdr.created_by_id, action="approve")

    try:
        a_rec = record_approval_decision(
            session=session,
            approver=current_user,
            decision=req.decision,
            fdr=fdr,
            council_order_ref=req.council_order_ref,
            reason=req.remarks,
            document_version_id=req.document_version_id,
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
        "document_version_id": a_rec.document_version_id,
    }


# =====================================================================
# Renewal Requests & Operations
# =====================================================================

@router.post("/fdrs/{fdr_id}/renewals", status_code=status.HTTP_201_CREATED, summary="Create renewal request for an FDR")
def create_renewal_request(
    fdr_id: int,
    req: RenewalCreateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Creates a new renewal request for an eligible FDR.
    """
    if current_user.role not in (UserRole.INSTITUTION_OFFICER.value, UserRole.AICTE_ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: role '{current_user.role}' cannot create renewal requests.",
        )

    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR {fdr_id} not found.")

    enforce_institution_isolation(user=current_user, target_institution_id=fdr.institution_id)

    if fdr.status in (FDRStatus.REJECTED.value, FDRStatus.CLOSED.value, FDRStatus.DRAFT.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot initiate renewal on FDR in '{fdr.status}' status.",
        )

    if fdr.issue_date and req.proposed_maturity_date < fdr.issue_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proposed maturity date cannot be earlier than the original FDR issue date.",
        )
    if fdr.maturity_date and req.proposed_maturity_date <= fdr.maturity_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proposed maturity date must extend beyond the current maturity date.",
        )

    prop_fdr_num = (req.proposed_fdr_number or fdr.fdr_number).strip()
    prop_rate = (req.proposed_interest_rate or fdr.interest_rate or "").strip()
    differ_flag = (
        (prop_fdr_num != fdr.fdr_number)
        or (req.proposed_maturity_date != fdr.maturity_date)
        or (prop_rate != (fdr.interest_rate or ""))
    )

    meta = {
        "proposed_maturity_date": str(req.proposed_maturity_date),
        "proposed_fdr_number": prop_fdr_num,
        "proposed_interest_rate": prop_rate,
        "supporting_document_id": req.supporting_document_id,
        "applicant_notes": req.applicant_notes or "",
        "differ_flag": differ_flag,
    }

    workflow_req = WorkflowRequest(
        fdr_id=fdr.id,
        request_type=RequestType.RENEWAL.value,
        status=RenewalStatus.REQUESTED.value,
        reason=req.reason,
        applicant_notes=json.dumps(meta),
        created_by_id=current_user.id,
    )
    session.add(workflow_req)
    session.flush()

    if req.supporting_document_id:
        doc = session.query(DocumentVersion).filter_by(id=req.supporting_document_id).first()
        if doc:
            doc.request_id = workflow_req.id

    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="RENEWAL_REQUEST_CREATED",
        target_type="REQUEST",
        target_id=str(workflow_req.id),
        details=f"Renewal request created for FDR {fdr.fdr_number}. Reason: {req.reason}",
    )
    session.add(audit)
    session.commit()

    return {
        "request_id": workflow_req.id,
        "fdr_id": fdr.id,
        "request_type": workflow_req.request_type,
        "status": workflow_req.status,
        "reason": workflow_req.reason,
        "proposed_maturity_date": str(req.proposed_maturity_date),
        "proposed_fdr_number": prop_fdr_num,
        "proposed_interest_rate": prop_rate,
        "discrepancy_flags": [DiscrepancyCode.RENEWAL_DETAILS_DIFFER_FROM_CURRENT_RECORD.value] if differ_flag else [],
        "created_by_id": workflow_req.created_by_id,
        "created_at": workflow_req.created_at.isoformat() if workflow_req.created_at else None,
    }


# =====================================================================
# Release & Refund Requests & Operations
# =====================================================================

@router.post("/fdrs/{fdr_id}/release-requests", status_code=status.HTTP_201_CREATED, summary="Create release and refund request for an FDR")
def create_release_request(
    fdr_id: int,
    req: ReleaseCreateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Creates a new release/refund request for an eligible FDR.
    - Role: INSTITUTION_OFFICER (or AICTE_ADMIN).
    - Strict institution isolation: Cannot initiate release for another institution's FDR.
    - Eligible statuses: ACTIVE, MATURING_SOON, MATURED.
    - Prevents duplicate active release requests on the same FDR.
    """
    if current_user.role not in (UserRole.INSTITUTION_OFFICER.value, UserRole.AICTE_ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: role '{current_user.role}' cannot create release requests.",
        )

    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR {fdr_id} not found.")

    enforce_institution_isolation(user=current_user, target_institution_id=fdr.institution_id)

    if fdr.status in (FDRStatus.DRAFT.value, FDRStatus.REJECTED.value, FDRStatus.CLOSED.value, FDRStatus.RELEASED_REFUNDED.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot initiate release request on FDR in '{fdr.status}' status.",
        )

    # Prevent duplicate active release request
    existing_active = (
        session.query(WorkflowRequest)
        .filter(
            WorkflowRequest.fdr_id == fdr.id,
            WorkflowRequest.request_type == RequestType.RELEASE_REFUND.value,
            WorkflowRequest.status.notin_([
                ReleaseStatus.RELEASED_REFUNDED.value,
                ReleaseStatus.REJECTED.value,
                ReleaseStatus.CANCELLED.value,
            ])
        )
        .first()
    )
    if existing_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An active release request (#{existing_active.id}) already exists for FDR {fdr.fdr_number} (status: '{existing_active.status}').",
        )

    workflow_req = WorkflowRequest(
        fdr_id=fdr.id,
        request_type=RequestType.RELEASE_REFUND.value,
        status=ReleaseStatus.REQUESTED.value,
        reason=req.reason,
        applicant_notes=req.applicant_notes,
        created_by_id=current_user.id,
    )
    session.add(workflow_req)
    session.flush()

    if req.supporting_document_id:
        doc = session.query(DocumentVersion).filter_by(id=req.supporting_document_id).first()
        if doc:
            doc.request_id = workflow_req.id

    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="RELEASE_REQUEST_CREATED",
        target_type="REQUEST",
        target_id=str(workflow_req.id),
        details=f"Release & refund request created for FDR {fdr.fdr_number}. Reason: {req.reason}",
    )
    session.add(audit)
    session.commit()

    return {
        "request_id": workflow_req.id,
        "fdr_id": fdr.id,
        "request_type": workflow_req.request_type,
        "status": workflow_req.status,
        "reason": workflow_req.reason,
        "created_by_id": workflow_req.created_by_id,
        "created_at": workflow_req.created_at.isoformat() if workflow_req.created_at else None,
    }


# =====================================================================
# Workflow Requests Listing & Detail
# =====================================================================

@router.get("/requests", summary="List workflow requests scoped by role and institution")
def list_workflow_requests(
    request_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    fdr_id: Optional[int] = Query(None),
    institution_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Returns workflow requests scoped by role and institution.
    """
    query = session.query(WorkflowRequest).join(FDR, WorkflowRequest.fdr_id == FDR.id)

    if current_user.role == UserRole.INSTITUTION_OFFICER.value:
        if institution_id is not None and institution_id != current_user.institution_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: cannot view workflow requests from another institution.",
            )
        query = query.filter(FDR.institution_id == current_user.institution_id)
    else:
        if institution_id is not None:
            query = query.filter(FDR.institution_id == institution_id)

    if request_type and request_type.lower() != "all":
        query = query.filter(WorkflowRequest.request_type == request_type)
    if status_filter and status_filter.lower() != "all":
        query = query.filter(WorkflowRequest.status == status_filter)
    if fdr_id is not None:
        query = query.filter(WorkflowRequest.fdr_id == fdr_id)

    requests = query.order_by(WorkflowRequest.id.desc()).all()

    result = []
    for r in requests:
        parsed_info = _extract_proposed_details(r)
        result.append({
            "id": r.id,
            "fdr_id": r.fdr_id,
            "fdr_number": r.fdr.fdr_number if r.fdr else None,
            "institution_id": r.fdr.institution_id if r.fdr else None,
            "institution_name": r.fdr.institution.name if (r.fdr and r.fdr.institution) else None,
            "bank_name": r.fdr.bank_name if r.fdr else None,
            "branch": r.fdr.branch if r.fdr else None,
            "amount": float(r.fdr.amount) if r.fdr else 0.0,
            "current_maturity_date": r.fdr.maturity_date.isoformat() if (r.fdr and r.fdr.maturity_date) else None,
            "current_interest_rate": r.fdr.interest_rate if r.fdr else None,
            "request_type": r.request_type,
            "status": r.status,
            "reason": r.reason,
            "applicant_notes": r.applicant_notes,
            "officer_remarks": r.officer_remarks,
            "council_order_ref": r.council_order_ref,
            "readiness_remarks": r.readiness_remarks,
            "confirmation_reference": r.confirmation_reference,
            "confirmation_timestamp": r.confirmation_timestamp.isoformat() if r.confirmation_timestamp else None,
            "proposed_details": parsed_info["proposed_details"],
            "discrepancy_flags": parsed_info["discrepancy_flags"],
            "created_by_id": r.created_by_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        })
    return result


@router.get("/requests/{request_id}", summary="Get workflow request detail with resource-level authorization")
def get_workflow_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Returns workflow request detail with comparative information.
    """
    req_obj = session.query(WorkflowRequest).filter_by(id=request_id).first()
    if not req_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow request {request_id} not found.",
        )

    if req_obj.fdr:
        enforce_institution_isolation(user=current_user, target_institution_id=req_obj.fdr.institution_id)

    parsed_info = _extract_proposed_details(req_obj)

    return {
        "id": req_obj.id,
        "fdr_id": req_obj.fdr_id,
        "fdr_number": req_obj.fdr.fdr_number if req_obj.fdr else None,
        "institution_id": req_obj.fdr.institution_id if req_obj.fdr else None,
        "institution_name": req_obj.fdr.institution.name if (req_obj.fdr and req_obj.fdr.institution) else None,
        "bank_name": req_obj.fdr.bank_name if req_obj.fdr else None,
        "branch": req_obj.fdr.branch if req_obj.fdr else None,
        "amount": float(req_obj.fdr.amount) if req_obj.fdr else 0.0,
        "current_maturity_date": req_obj.fdr.maturity_date.isoformat() if (req_obj.fdr and req_obj.fdr.maturity_date) else None,
        "current_interest_rate": req_obj.fdr.interest_rate if req_obj.fdr else None,
        "request_type": req_obj.request_type,
        "status": req_obj.status,
        "reason": req_obj.reason,
        "applicant_notes": req_obj.applicant_notes,
        "officer_remarks": req_obj.officer_remarks,
        "council_order_ref": req_obj.council_order_ref,
        "readiness_remarks": req_obj.readiness_remarks,
        "confirmation_reference": req_obj.confirmation_reference,
        "confirmation_timestamp": req_obj.confirmation_timestamp.isoformat() if req_obj.confirmation_timestamp else None,
        "proposed_details": parsed_info["proposed_details"],
        "discrepancy_flags": parsed_info["discrepancy_flags"],
        "created_by_id": req_obj.created_by_id,
        "created_at": req_obj.created_at.isoformat() if req_obj.created_at else None,
        "updated_at": req_obj.updated_at.isoformat() if req_obj.updated_at else None,
    }


# =====================================================================
# Shared Actions: Verification, Approval, Resubmission, Cancellation
# =====================================================================

@router.post("/requests/{request_id}/start-verification", summary="Claim workflow request for verification review")
def start_request_verification(
    request_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Verification Officer claims submitted request for scrutiny.
    - Role: VERIFICATION_OFFICER or AICTE_ADMIN.
    - Separation of duties: Submitter cannot verify.
    - Transitions REQUESTED -> UNDER_VERIFICATION.
    """
    if current_user.role not in (UserRole.VERIFICATION_OFFICER.value, UserRole.AICTE_ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: role '{current_user.role}' cannot claim verification review.",
        )

    req_obj = session.query(WorkflowRequest).filter_by(id=request_id).first()
    if not req_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow request {request_id} not found.")

    enforce_separation_of_duties(actor=current_user, submitter_id=req_obj.created_by_id, action="verify")

    if req_obj.status != "REQUESTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot claim verification on request in '{req_obj.status}' status. Must be 'REQUESTED'.",
        )

    req_obj.status = "UNDER_VERIFICATION"

    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="REQUEST_VERIFICATION_CLAIMED",
        target_type="REQUEST",
        target_id=str(req_obj.id),
        details=f"Scrutiny review started by {current_user.full_name}",
    )
    session.add(audit)
    session.commit()

    return {
        "request_id": req_obj.id,
        "status": req_obj.status,
    }


@router.post("/requests/{request_id}/verify", summary="Record workflow request verification decision")
def verify_workflow_request(
    request_id: int,
    req: VerificationRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Records verification scrutiny for a workflow request.
    """
    if current_user.role not in (UserRole.VERIFICATION_OFFICER.value, UserRole.AICTE_ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: role '{current_user.role}' is not authorized to verify workflow requests.",
        )

    req_obj = session.query(WorkflowRequest).filter_by(id=request_id).first()
    if not req_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow request {request_id} not found.")

    enforce_separation_of_duties(actor=current_user, submitter_id=req_obj.created_by_id, action="verify")

    try:
        v_rec = record_verification_decision(
            session=session,
            officer=current_user,
            decision=req.decision,
            request=req_obj,
            remarks=req.remarks,
            discrepancy_code=req.discrepancy_code,
            discrepancy_severity=req.discrepancy_severity,
            discrepancy_note=req.discrepancy_note,
            document_version_id=req.document_version_id,
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
        "request_id": req_obj.id,
        "decision": v_rec.decision,
        "new_status": req_obj.status,
        "document_version_id": v_rec.document_version_id,
    }


@router.post("/requests/{request_id}/resubmit", summary="Resubmit corrected workflow request")
def resubmit_workflow_request(
    request_id: int,
    req: RequestResubmitRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Resubmits a workflow request that was returned for clarification.
    - Role: Owning INSTITUTION_OFFICER (or AICTE_ADMIN).
    - Status invariant: Request must be in 'CORRECTION_REQUIRED'.
    - Moves request back to 'REQUESTED'.
    """
    if current_user.role not in (UserRole.INSTITUTION_OFFICER.value, UserRole.AICTE_ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: role '{current_user.role}' cannot resubmit requests.",
        )

    req_obj = session.query(WorkflowRequest).filter_by(id=request_id).first()
    if not req_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow request {request_id} not found.")

    if req_obj.fdr:
        enforce_institution_isolation(user=current_user, target_institution_id=req_obj.fdr.institution_id)

    if req_obj.status != "CORRECTION_REQUIRED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot resubmit request in '{req_obj.status}' status. Must be 'CORRECTION_REQUIRED'.",
        )

    req_obj.status = "REQUESTED"
    if req.remarks:
        req_obj.applicant_notes = (req_obj.applicant_notes or "") + f" [Resubmitted: {req.remarks}]"

    if req.supporting_document_id:
        doc = session.query(DocumentVersion).filter_by(id=req.supporting_document_id).first()
        if doc:
            doc.request_id = req_obj.id

    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="REQUEST_RESUBMITTED",
        target_type="REQUEST",
        target_id=str(req_obj.id),
        details=f"Request {req_obj.id} resubmitted with remarks: {req.remarks or 'N/A'}",
    )
    session.add(audit)
    session.commit()

    return {
        "request_id": req_obj.id,
        "status": req_obj.status,
    }


@router.post("/requests/{request_id}/cancel", summary="Cancel pending workflow request")
def cancel_workflow_request(
    request_id: int,
    req: RequestCancelRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Cancels a workflow request before scrutiny starts.
    - Role: Owning INSTITUTION_OFFICER (or AICTE_ADMIN).
    - Status invariant: Request must be in 'REQUESTED'.
    - Moves request to 'CANCELLED'.
    """
    if current_user.role not in (UserRole.INSTITUTION_OFFICER.value, UserRole.AICTE_ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: role '{current_user.role}' cannot cancel requests.",
        )

    req_obj = session.query(WorkflowRequest).filter_by(id=request_id).first()
    if not req_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow request {request_id} not found.")

    if req_obj.fdr:
        enforce_institution_isolation(user=current_user, target_institution_id=req_obj.fdr.institution_id)

    if req_obj.status != "REQUESTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel request in '{req_obj.status}' status. Verification has already started or request is inactive.",
        )

    req_obj.status = "CANCELLED"
    req_obj.officer_remarks = f"Cancelled: {req.reason}"

    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="REQUEST_CANCELLED",
        target_type="REQUEST",
        target_id=str(req_obj.id),
        details=f"Request {req_obj.id} cancelled by institution. Reason: {req.reason}",
    )
    session.add(audit)
    session.commit()

    return {
        "request_id": req_obj.id,
        "status": req_obj.status,
        "reason": req.reason,
    }


@router.post("/requests/{request_id}/approval", summary="Record workflow request approval decision")
def approve_workflow_request(
    request_id: int,
    req: ApprovalRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Records approval or rejection for a workflow request.
    """
    if current_user.role not in (UserRole.APPROVING_AUTHORITY.value, UserRole.AICTE_ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: role '{current_user.role}' is not authorized to approve workflow requests.",
        )

    if req.decision == "REJECTED" and (not req.remarks or not req.remarks.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rejection decision requires a reason or remarks.",
        )

    req_obj = session.query(WorkflowRequest).filter_by(id=request_id).first()
    if not req_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow request {request_id} not found.")

    enforce_separation_of_duties(actor=current_user, submitter_id=req_obj.created_by_id, action="approve")

    try:
        a_rec = record_approval_decision(
            session=session,
            approver=current_user,
            decision=req.decision,
            request=req_obj,
            council_order_ref=req.council_order_ref,
            reason=req.remarks,
            document_version_id=req.document_version_id,
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
        "request_id": req_obj.id,
        "decision": a_rec.decision,
        "new_status": req_obj.status,
        "document_version_id": a_rec.document_version_id,
    }


# =====================================================================
# Release Readiness & Confirmation Endpoints
# =====================================================================

@router.post("/requests/{request_id}/release-confirmation/ready", summary="Stage release request as ready for confirmation")
def set_release_readiness(
    request_id: int,
    req: ReleaseReadinessRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Stages an approved release request as ready for confirmation:
    - Role: APPROVING_AUTHORITY or AICTE_ADMIN.
    - Status invariant: Request must be in 'RELEASE_APPROVED' status.
      Attempting confirmation before readiness or from an invalid state returns 409 Conflict.
    - Transitions RELEASE_APPROVED -> AWAITING_CONFIRMATION.
    - Note: This action confirms administrative readiness only; no funds move.
    """
    if current_user.role not in (UserRole.APPROVING_AUTHORITY.value, UserRole.AICTE_ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: role '{current_user.role}' cannot stage release readiness.",
        )

    req_obj = session.query(WorkflowRequest).filter_by(id=request_id).first()
    if not req_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow request {request_id} not found.")

    if req_obj.request_type != RequestType.RELEASE_REFUND.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Readiness staging is only applicable to release/refund requests.",
        )

    if req_obj.status != ReleaseStatus.RELEASE_APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invalid transition: request must be in 'RELEASE_APPROVED' status to stage readiness (current status: '{req_obj.status}').",
        )

    req_obj.status = ReleaseStatus.AWAITING_CONFIRMATION.value
    req_obj.readiness_remarks = req.remarks or "Supporting confirmation details ready for recording."

    if req_obj.fdr:
        record_status_transition(
            session=session,
            fdr=req_obj.fdr,
            to_status=FDRStatus.AWAITING_CONFIRMATION.value,
            actor=current_user,
            reason=req.remarks or "Release readiness staged",
            request=req_obj,
            transition_type="RELEASE_WORKFLOW",
        )

    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="RELEASE_READINESS_CONFIRMED",
        target_type="REQUEST",
        target_id=str(req_obj.id),
        details=f"Release readiness staged for request {req_obj.id}. Status moved to AWAITING_CONFIRMATION (No funds moved).",
    )
    session.add(audit)
    session.commit()

    return {
        "request_id": req_obj.id,
        "status": req_obj.status,
    }


@router.post("/requests/{request_id}/release-confirmation", summary="Record disbursement confirmation reference")
def confirm_release_disbursement(
    request_id: int,
    req: ReleaseConfirmationRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Records disbursement confirmation reference:
    - Role: APPROVING_AUTHORITY or AICTE_ADMIN.
    - Status invariant: Request must be in 'AWAITING_CONFIRMATION'.
      Calling from any other status (including RELEASE_APPROVED) returns 409 Conflict.
    - Transitions AWAITING_CONFIRMATION -> RELEASED_REFUNDED.
    - Discloses demo simulation: Records voucher reference without actual fund transfer.
    """
    if current_user.role not in (UserRole.APPROVING_AUTHORITY.value, UserRole.AICTE_ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: role '{current_user.role}' cannot record release confirmation.",
        )

    req_obj = session.query(WorkflowRequest).filter_by(id=request_id).first()
    if not req_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow request {request_id} not found.")

    if req_obj.request_type != RequestType.RELEASE_REFUND.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Release confirmation is only applicable to release/refund requests.",
        )

    if req_obj.status != ReleaseStatus.AWAITING_CONFIRMATION.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invalid transition: cannot confirm release from status '{req_obj.status}'. Readiness must be confirmed first (status must be 'AWAITING_CONFIRMATION').",
        )

    now_ts = datetime.now(timezone.utc)
    req_obj.status = ReleaseStatus.RELEASED_REFUNDED.value
    req_obj.confirmation_reference = req.confirmation_reference
    req_obj.confirmation_timestamp = now_ts
    if req.remarks:
        req_obj.officer_remarks = req.remarks

    if req_obj.fdr:
        record_status_transition(
            session=session,
            fdr=req_obj.fdr,
            to_status=FDRStatus.RELEASED_REFUNDED.value,
            actor=current_user,
            reason=f"Disbursement confirmed (Ref: {req.confirmation_reference})",
            request=req_obj,
            transition_type="RELEASE_CONFIRMATION",
        )

    if req.voucher_document_id:
        doc = session.query(DocumentVersion).filter_by(id=req.voucher_document_id).first()
        if doc:
            doc.request_id = req_obj.id

    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="RELEASE_CONFIRMATION_RECORDED",
        target_type="REQUEST",
        target_id=str(req_obj.id),
        details=f"Disbursement confirmation recorded with reference {req.confirmation_reference} (SIMULATED/DEMO). Status moved to RELEASED_REFUNDED.",
    )
    session.add(audit)
    session.commit()

    return {
        "request_id": req_obj.id,
        "status": req_obj.status,
        "confirmation_reference": req_obj.confirmation_reference,
        "confirmed_by": current_user.id,
        "confirmed_at": req_obj.confirmation_timestamp.isoformat(),
        "fdr_status": req_obj.fdr.status if req_obj.fdr else None,
        "is_simulated": True,
    }


# =====================================================================
# Renewal Completion
# =====================================================================

@router.post("/requests/{request_id}/complete", summary="Complete approved renewal and update FDR transactionally")
def complete_renewal_endpoint(
    request_id: int,
    req: RenewalCompleteRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Completes an approved renewal request:
    - Role: INSTITUTION_OFFICER (for that FDR) or AICTE_ADMIN.
    - Requires request status == 'APPROVED' and request_type == 'RENEWAL'.
    - Updates underlying FDR transactionally to ACTIVE with new maturity date and number.
    - Retains prior values and documents in history.
    - Updates request to COMPLETED.
    """
    if current_user.role not in (UserRole.INSTITUTION_OFFICER.value, UserRole.AICTE_ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: role '{current_user.role}' cannot complete renewal requests.",
        )

    req_obj = session.query(WorkflowRequest).filter_by(id=request_id).first()
    if not req_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow request {request_id} not found.")

    if req_obj.fdr:
        enforce_institution_isolation(user=current_user, target_institution_id=req_obj.fdr.institution_id)

    if req_obj.request_type != RequestType.RENEWAL.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot complete renewal on a non-renewal request.",
        )
    if req_obj.status != RenewalStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot complete renewal from status '{req_obj.status}'. Request must be 'APPROVED'.",
        )

    if req_obj.fdr and req_obj.fdr.issue_date and req.renewed_maturity_date < req_obj.fdr.issue_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Renewed maturity date cannot be earlier than the FDR issue date.",
        )

    try:
        hist_entry = complete_fdr_renewal(
            session=session,
            request=req_obj,
            actor=current_user,
            renewed_fdr_number=req.renewed_fdr_number,
            renewed_maturity_date=req.renewed_maturity_date,
            renewal_document_id=req.renewal_document_id,
            renewed_interest_rate=req.renewed_interest_rate,
            remarks=req.remarks or "Renewal completion",
        )
        session.commit()
    except (InvalidStatusTransitionError, ValueError) as e:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {
        "request_id": req_obj.id,
        "fdr_id": req_obj.fdr_id,
        "request_status": req_obj.status,
        "fdr_status": req_obj.fdr.status,
        "renewed_fdr_number": req_obj.fdr.fdr_number,
        "renewed_maturity_date": req_obj.fdr.maturity_date.isoformat() if req_obj.fdr.maturity_date else None,
        "renewal_history_id": hist_entry.id,
    }
