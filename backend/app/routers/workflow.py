"""
Workflow Verification & Approval Operations Router.
Enforces Section 8.3 of REQUIREMENTS_UPDATED.md:
- Role boundaries: Scrutiny/Verification is strictly reserved for VERIFICATION_OFFICER.
- Role boundaries: Final Approval is strictly reserved for APPROVING_AUTHORITY.
- Separation of duties: Submitter CANNOT verify or approve their own submission.
- Rejection of unauthenticated requests with 401 Unauthorized.
- Rejection of unauthorized roles with 403 Forbidden.
"""

from datetime import date, datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.enums import UserRole, FDRStatus, RequestType, RenewalStatus, ReleaseStatus
from app.models.fdr import FDR, FDRRenewalHistory
from app.models.workflow import WorkflowRequest, VerificationRecord, ApprovalRecord
from app.models.user import User
from app.models.audit import AuditLog
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
)

router = APIRouter(prefix="/api/v1", tags=["Workflow Verification & Approval"])


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
    reason: Optional[str] = Field("Scheduled Maturity Renewal", description="Reason for renewal request")
    applicant_notes: Optional[str] = Field(None, description="Additional notes from institution")
    renewed_maturity_date: Optional[date] = None
    renewed_interest_rate: Optional[str] = None
    renewal_document_id: Optional[int] = None
    fdr_id: Optional[int] = None


class RenewalCompleteRequest(BaseModel):
    renewed_fdr_number: str = Field(..., min_length=1, description="New certificate/FDR number after renewal")
    renewed_maturity_date: date = Field(..., description="New maturity date")
    renewed_interest_rate: Optional[str] = Field(None, description="New interest rate if updated")
    renewal_document_id: Optional[int] = Field(None, description="DocumentVersion ID for renewed certificate")
    remarks: Optional[str] = Field(None, description="Renewal execution remarks")


class ReleaseCreateRequest(BaseModel):
    reason: Optional[str] = Field("Closure of Academic Programme", description="Statutory justification for release")
    applicant_notes: Optional[str] = Field(None, description="Additional notes or references")
    fdr_id: Optional[int] = None


class RequestTransitionRequest(BaseModel):
    transition_type: str = Field(..., description="START_VERIFICATION, VERIFY_APPROVE, REQUEST_CORRECTION, RESUBMIT, APPROVE, REJECT, CONFIRM_READINESS, CONFIRM_RELEASE, CANCEL")
    remarks: Optional[str] = None
    reason: Optional[str] = None
    council_order_ref: Optional[str] = None
    order_ref: Optional[str] = None
    confirmation_ref: Optional[str] = None
    confirmation_reference: Optional[str] = None
    voucher_file: Optional[str] = None
    document_version_id: Optional[int] = None


def _serialize_request(req_obj: WorkflowRequest) -> Dict[str, Any]:
    fdr = req_obj.fdr
    inst = fdr.institution if fdr else None
    return {
        "id": req_obj.id,
        "fdr_id": req_obj.fdr_id,
        "request_type": req_obj.request_type,
        "status": req_obj.status,
        "reason": req_obj.reason,
        "applicant_notes": req_obj.applicant_notes,
        "officer_remarks": req_obj.officer_remarks,
        "council_order_ref": req_obj.council_order_ref,
        "approval_date": req_obj.approval_date.isoformat() if req_obj.approval_date else None,
        "readiness_remarks": req_obj.readiness_remarks,
        "confirmation_reference": req_obj.confirmation_reference,
        "confirmation_timestamp": req_obj.confirmation_timestamp.isoformat() if req_obj.confirmation_timestamp else None,
        "created_by_id": req_obj.created_by_id,
        "created_at": req_obj.created_at.isoformat() if req_obj.created_at else None,
        "updated_at": req_obj.updated_at.isoformat() if req_obj.updated_at else None,
        # Joined FDR & Institution attributes for both snake_case and camelCase consumption
        "fdr_number": fdr.fdr_number if fdr else None,
        "fdrNumber": fdr.fdr_number if fdr else None,
        "institution_id": fdr.institution_id if fdr else None,
        "institution_name": inst.name if inst else None,
        "institutionName": inst.name if inst else None,
        "aicte_pid": inst.aicte_pid if inst else None,
        "aictePid": inst.aicte_pid if inst else None,
        "bank_name": fdr.bank_name if fdr else None,
        "bank": fdr.bank_name if fdr else None,
        "branch": fdr.branch if fdr else None,
        "amount": float(fdr.amount) if fdr else 0.0,
        "deposit_amount": float(fdr.amount) if fdr else 0.0,
        "maturity_date": fdr.maturity_date.isoformat() if fdr and fdr.maturity_date else None,
        "maturityDate": fdr.maturity_date.isoformat() if fdr and fdr.maturity_date else None,
        "fdr_status": fdr.status if fdr else None,
    }


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

    # 2. Rejection reason check
    if req.decision == "REJECTED" and (not req.remarks or not req.remarks.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rejection decision requires a reason or remarks.",
        )

    # 3. Separation of duties
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


@router.get("/requests", summary="List workflow requests with role-based scoping and filtering")
def list_workflow_requests(
    request_type: Optional[str] = Query(None, description="RENEWAL or RELEASE_REFUND"),
    request_status: Optional[str] = Query(None, alias="status", description="Filter by status"),
    fdr_id: Optional[int] = Query(None),
    institution_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Returns workflow requests (renewals and release/refund) scoped by role and institution.
    """
    query = session.query(WorkflowRequest).join(WorkflowRequest.fdr)

    # Institution isolation
    if current_user.role == UserRole.INSTITUTION_OFFICER.value:
        if institution_id is not None and institution_id != current_user.institution_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: cannot query requests belonging to another institution.",
            )
        query = query.filter(FDR.institution_id == current_user.institution_id)
    elif institution_id is not None:
        query = query.filter(FDR.institution_id == institution_id)

    if request_type:
        query = query.filter(WorkflowRequest.request_type == request_type)
    if request_status:
        query = query.filter(WorkflowRequest.status == request_status)
    if fdr_id:
        query = query.filter(WorkflowRequest.fdr_id == fdr_id)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (FDR.fdr_number.ilike(search_filter))
            | (FDR.bank_name.ilike(search_filter))
            | (WorkflowRequest.reason.ilike(search_filter))
        )

    total = query.count()
    items = query.order_by(WorkflowRequest.id.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "items": [_serialize_request(r) for r in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/requests/{request_id}", summary="Get workflow request detail with resource-level authorization")
def get_workflow_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Returns workflow request detail.
    Enforces resource-level authorization:
    - Request must exist in database (404 if not found).
    - Institution Officers can ONLY access requests associated with their own institution's FDR (403 otherwise).
    - AICTE Admin, Verifiers, and Approvers have oversight.
    """
    req_obj = session.query(WorkflowRequest).filter_by(id=request_id).first()
    if not req_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow request {request_id} not found.",
        )

    if req_obj.fdr:
        enforce_institution_isolation(user=current_user, target_institution_id=req_obj.fdr.institution_id)

    return _serialize_request(req_obj)


@router.post("/requests/{request_id}/verify", summary="Record workflow request verification decision")
def verify_workflow_request(
    request_id: int,
    req: VerificationRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Records verification scrutiny for a workflow request.
    Enforces:
    - Role check: Only VERIFICATION_OFFICER (or AICTE_ADMIN).
    - Separation of duties: Submitter cannot verify their own request.
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


@router.post("/requests/{request_id}/approval", summary="Record workflow request approval decision")
def approve_workflow_request(
    request_id: int,
    req: ApprovalRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Records approval or rejection for a workflow request.
    Enforces:
    - Role check: Only APPROVING_AUTHORITY (or AICTE_ADMIN).
    - Separation of duties: Submitter cannot approve their own request.
    - Rejection requires a reason.
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


@router.post("/fdrs/{fdr_id}/renewals", summary="Submit a renewal request for an FDR")
def create_fdr_renewal_request(
    fdr_id: int,
    req: RenewalCreateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Submits a renewal request for an existing FDR.
    Enforces:
    - Allowed roles: INSTITUTION_OFFICER (for own institution) or AICTE_ADMIN.
    - FDR must be active/maturing/matured.
    - Prevents concurrent duplicate active renewal requests on the same FDR.
    - Transitions FDR to RENEWAL_REQUESTED and creates WorkflowRequest.
    """
    if current_user.role not in (UserRole.INSTITUTION_OFFICER.value, UserRole.AICTE_ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: role '{current_user.role}' cannot submit renewal requests.",
        )

    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR {fdr_id} not found.")

    enforce_institution_isolation(user=current_user, target_institution_id=fdr.institution_id)

    eligible_statuses = [FDRStatus.ACTIVE.value, FDRStatus.MATURING_SOON.value, FDRStatus.MATURED.value]
    if fdr.status not in eligible_statuses:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot request renewal for FDR with status '{fdr.status}'. FDR must be in ACTIVE, MATURING_SOON, or MATURED.",
        )

    active_req = session.query(WorkflowRequest).filter(
        WorkflowRequest.fdr_id == fdr.id,
        WorkflowRequest.request_type == RequestType.RENEWAL.value,
        WorkflowRequest.status.in_([
            RenewalStatus.REQUESTED.value,
            RenewalStatus.UNDER_VERIFICATION.value,
            RenewalStatus.CORRECTION_REQUIRED.value,
            RenewalStatus.PENDING_APPROVAL.value,
            RenewalStatus.APPROVED.value,
        ])
    ).first()
    if active_req:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An active renewal request (#{active_req.id}) already exists for FDR {fdr.fdr_number}.",
        )

    record_status_transition(
        session=session,
        fdr=fdr,
        to_status=FDRStatus.RENEWAL_REQUESTED.value,
        actor=current_user,
        reason=req.reason or "Renewal requested",
        transition_type="RENEWAL_LIFECYCLE",
    )

    wf_req = WorkflowRequest(
        fdr_id=fdr.id,
        request_type=RequestType.RENEWAL.value,
        status=RenewalStatus.REQUESTED.value,
        reason=req.reason or "Scheduled Maturity Renewal",
        applicant_notes=req.applicant_notes,
        created_by_id=current_user.id,
    )
    session.add(wf_req)
    session.flush()

    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="CREATE_RENEWAL_REQUEST",
        target_type="REQUEST",
        target_id=str(wf_req.id),
        details=f"Renewal request #{wf_req.id} submitted for FDR {fdr.fdr_number} (Amount: {fdr.amount}).",
    )
    session.add(audit)
    session.commit()

    return _serialize_request(wf_req)


@router.post("/requests/renewal", summary="Submit a renewal request specifying fdr_id in payload")
def create_renewal_request_direct(
    req: RenewalCreateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    if not req.fdr_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="fdr_id is required in body.")
    return create_fdr_renewal_request(fdr_id=req.fdr_id, req=req, current_user=current_user, session=session)


@router.post("/requests/{request_id}/complete-renewal", summary="Complete an approved renewal request")
def complete_renewal_request(
    request_id: int,
    req: RenewalCompleteRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Completes an approved renewal:
    - Retains prior values in FDRRenewalHistory
    - Updates FDR to ACTIVE with new FDR number and maturity date
    - Updates request to COMPLETED
    - Appends audit logs and provenance entries
    """
    wf_req = session.query(WorkflowRequest).filter_by(id=request_id).first()
    if not wf_req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow request {request_id} not found.")

    if wf_req.request_type != RequestType.RENEWAL.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not a renewal request.")

    if wf_req.fdr:
        enforce_institution_isolation(user=current_user, target_institution_id=wf_req.fdr.institution_id)

    try:
        renewal_hist = complete_fdr_renewal(
            session=session,
            request=wf_req,
            actor=current_user,
            renewed_fdr_number=req.renewed_fdr_number,
            renewed_maturity_date=req.renewed_maturity_date,
            renewal_document_id=req.renewal_document_id,
            renewed_interest_rate=req.renewed_interest_rate,
            remarks=req.remarks,
        )
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {
        "message": "Renewal completed successfully",
        "renewal_id": renewal_hist.id,
        "request_id": wf_req.id,
        "fdr_id": wf_req.fdr_id,
        "new_fdr_number": renewal_hist.renewed_fdr_number,
        "new_maturity_date": renewal_hist.renewed_maturity_date.isoformat(),
        "fdr_status": wf_req.fdr.status,
        "request_status": wf_req.status,
    }


@router.post("/fdrs/{fdr_id}/releases", summary="Submit a release/refund request for an FDR")
def create_fdr_release_request(
    fdr_id: int,
    req: ReleaseCreateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Submits a release/refund request for an FDR.
    Enforces:
    - Role check: INSTITUTION_OFFICER (own institution) or AICTE_ADMIN.
    - Invariant: FDR must be in active/maturing/matured status.
    - Prevents duplicate active release requests on the same FDR.
    - Transitions FDR to RELEASE_REQUESTED.
    """
    if current_user.role not in (UserRole.INSTITUTION_OFFICER.value, UserRole.AICTE_ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden: role '{current_user.role}' cannot submit release requests.",
        )

    fdr = session.query(FDR).filter_by(id=fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR {fdr_id} not found.")

    enforce_institution_isolation(user=current_user, target_institution_id=fdr.institution_id)

    eligible_statuses = [FDRStatus.ACTIVE.value, FDRStatus.MATURING_SOON.value, FDRStatus.MATURED.value]
    if fdr.status not in eligible_statuses:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot request release for FDR with status '{fdr.status}'. FDR must be in ACTIVE, MATURING_SOON, or MATURED.",
        )

    active_req = session.query(WorkflowRequest).filter(
        WorkflowRequest.fdr_id == fdr.id,
        WorkflowRequest.request_type == RequestType.RELEASE_REFUND.value,
        WorkflowRequest.status.in_([
            ReleaseStatus.REQUESTED.value,
            ReleaseStatus.UNDER_VERIFICATION.value,
            ReleaseStatus.CORRECTION_REQUIRED.value,
            ReleaseStatus.PENDING_APPROVAL.value,
            ReleaseStatus.RELEASE_APPROVED.value,
            ReleaseStatus.AWAITING_CONFIRMATION.value,
        ])
    ).first()
    if active_req:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An active release request (#{active_req.id}) already exists for FDR {fdr.fdr_number}.",
        )

    record_status_transition(
        session=session,
        fdr=fdr,
        to_status=FDRStatus.RELEASE_REQUESTED.value,
        actor=current_user,
        reason=req.reason or "Release requested",
        transition_type="RELEASE_LIFECYCLE",
    )

    wf_req = WorkflowRequest(
        fdr_id=fdr.id,
        request_type=RequestType.RELEASE_REFUND.value,
        status=ReleaseStatus.REQUESTED.value,
        reason=req.reason or "Closure of Academic Programme",
        applicant_notes=req.applicant_notes,
        created_by_id=current_user.id,
    )
    session.add(wf_req)
    session.flush()

    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="CREATE_RELEASE_REQUEST",
        target_type="REQUEST",
        target_id=str(wf_req.id),
        details=f"Release request #{wf_req.id} submitted for FDR {fdr.fdr_number} (Amount: {fdr.amount}). Reason: {wf_req.reason}",
    )
    session.add(audit)
    session.commit()

    return _serialize_request(wf_req)


@router.post("/requests/release", summary="Submit a release request specifying fdr_id in payload")
def create_release_request_direct(
    req: ReleaseCreateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    if not req.fdr_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="fdr_id is required in body.")
    return create_fdr_release_request(fdr_id=req.fdr_id, req=req, current_user=current_user, session=session)


@router.post("/requests/{request_id}/transition", summary="Perform a lifecycle transition on a workflow request")
def transition_workflow_request(
    request_id: int,
    req: RequestTransitionRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Coordinates workflow transitions for release and renewal requests:
    - START_VERIFICATION: moves REQUESTED to UNDER_VERIFICATION (Verifiers/Admin)
    - VERIFY_APPROVE: records verified recommendation (Verifiers/Admin)
    - REQUEST_CORRECTION: records correction needed (Verifiers/Admin)
    - RESUBMIT: returns CORRECTION_REQUIRED to REQUESTED (Institution/Admin)
    - APPROVE: records approval decision and council order (Approver/Admin)
    - REJECT: records rejection decision (Approver/Admin)
    - CONFIRM_READINESS: moves RELEASE_APPROVED to AWAITING_CONFIRMATION (Admin/Verifiers)
    - CONFIRM_RELEASE: records UTR/voucher payment advice and completes release (Admin/Verifiers/Approvers)
    - CANCEL: applicant cancels pending request and restores FDR to ACTIVE
    """
    wf_req = session.query(WorkflowRequest).filter_by(id=request_id).first()
    if not wf_req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow request {request_id} not found.")

    t_type = req.transition_type.upper()

    if t_type == "START_VERIFICATION":
        if current_user.role not in (UserRole.VERIFICATION_OFFICER.value, UserRole.AICTE_ADMIN.value):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Verification Officers can initiate verification.")
        if wf_req.status != "REQUESTED":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Cannot start verification from status '{wf_req.status}'. Must be REQUESTED.")
        wf_req.status = "UNDER_VERIFICATION"

    elif t_type == "VERIFY_APPROVE":
        if current_user.role not in (UserRole.VERIFICATION_OFFICER.value, UserRole.AICTE_ADMIN.value):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Verification Officers can verify requests.")
        enforce_separation_of_duties(actor=current_user, submitter_id=wf_req.created_by_id, action="verify")
        record_verification_decision(
            session=session,
            officer=current_user,
            decision="VERIFIED",
            request=wf_req,
            remarks=req.remarks or "Verified and forwarded for approval",
            document_version_id=req.document_version_id,
        )

    elif t_type == "REQUEST_CORRECTION":
        if current_user.role not in (UserRole.VERIFICATION_OFFICER.value, UserRole.AICTE_ADMIN.value):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Verification Officers can request corrections.")
        enforce_separation_of_duties(actor=current_user, submitter_id=wf_req.created_by_id, action="verify")
        record_verification_decision(
            session=session,
            officer=current_user,
            decision="CORRECTION_REQUIRED",
            request=wf_req,
            remarks=req.remarks or "Correction required",
            document_version_id=req.document_version_id,
        )

    elif t_type == "RESUBMIT":
        if current_user.role not in (UserRole.INSTITUTION_OFFICER.value, UserRole.AICTE_ADMIN.value):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Institution Officers can resubmit requests.")
        if wf_req.fdr:
            enforce_institution_isolation(user=current_user, target_institution_id=wf_req.fdr.institution_id)
        if wf_req.status != "CORRECTION_REQUIRED":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Cannot resubmit from status '{wf_req.status}'. Must be CORRECTION_REQUIRED.")
        wf_req.status = "REQUESTED"
        if req.remarks:
            wf_req.applicant_notes = f"{wf_req.applicant_notes or ''}\nResubmission: {req.remarks}".strip()

    elif t_type == "APPROVE":
        if current_user.role not in (UserRole.APPROVING_AUTHORITY.value, UserRole.AICTE_ADMIN.value):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Approving Authority can approve requests.")
        enforce_separation_of_duties(actor=current_user, submitter_id=wf_req.created_by_id, action="approve")
        order_ref = req.council_order_ref or req.order_ref
        decision = "RELEASE_APPROVED" if wf_req.request_type == RequestType.RELEASE_REFUND.value else "APPROVED"
        record_approval_decision(
            session=session,
            approver=current_user,
            decision=decision,
            request=wf_req,
            council_order_ref=order_ref,
            reason=req.remarks or req.reason or "Approved by Council",
            document_version_id=req.document_version_id,
        )
        if order_ref:
            wf_req.council_order_ref = order_ref
            wf_req.approval_date = date.today()

    elif t_type == "REJECT":
        if current_user.role not in (UserRole.APPROVING_AUTHORITY.value, UserRole.AICTE_ADMIN.value):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Approving Authority can reject requests.")
        enforce_separation_of_duties(actor=current_user, submitter_id=wf_req.created_by_id, action="approve")
        rej_reason = req.reason or req.remarks
        if not rej_reason or not rej_reason.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rejection requires a reason or remarks.")
        record_approval_decision(
            session=session,
            approver=current_user,
            decision="REJECTED",
            request=wf_req,
            reason=rej_reason,
            document_version_id=req.document_version_id,
        )

    elif t_type == "CONFIRM_READINESS":
        if current_user.role not in (UserRole.AICTE_ADMIN.value, UserRole.VERIFICATION_OFFICER.value):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only AICTE Admin or Verification Officers can confirm readiness.")
        if wf_req.status != ReleaseStatus.RELEASE_APPROVED.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot confirm readiness from status '{wf_req.status}'. Must be RELEASE_APPROVED.",
            )
        wf_req.status = ReleaseStatus.AWAITING_CONFIRMATION.value
        wf_req.readiness_remarks = req.remarks or "Readiness confirmed."
        if wf_req.fdr:
            record_status_transition(
                session=session,
                fdr=wf_req.fdr,
                to_status=FDRStatus.AWAITING_CONFIRMATION.value,
                actor=current_user,
                reason=req.remarks or "Readiness confirmed",
                request=wf_req,
                transition_type="RELEASE_WORKFLOW",
            )

    elif t_type == "CONFIRM_RELEASE":
        if current_user.role not in (UserRole.AICTE_ADMIN.value, UserRole.VERIFICATION_OFFICER.value, UserRole.APPROVING_AUTHORITY.value):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized to confirm release.")
        if wf_req.status != ReleaseStatus.AWAITING_CONFIRMATION.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot confirm release from status '{wf_req.status}'. Must be AWAITING_CONFIRMATION.",
            )
        ref = req.confirmation_reference or req.confirmation_ref
        if not ref:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Confirmation reference (UTR/voucher) is required.")
        wf_req.status = ReleaseStatus.RELEASED_REFUNDED.value
        wf_req.confirmation_reference = ref
        wf_req.confirmation_timestamp = datetime.now(timezone.utc)
        if wf_req.fdr:
            record_status_transition(
                session=session,
                fdr=wf_req.fdr,
                to_status=FDRStatus.RELEASED_REFUNDED.value,
                actor=current_user,
                reason=f"Release confirmed. Reference: {ref}",
                request=wf_req,
                transition_type="RELEASE_COMPLETION",
            )

    elif t_type == "CANCEL":
        if current_user.role not in (UserRole.INSTITUTION_OFFICER.value, UserRole.AICTE_ADMIN.value):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only applicant institution or Admin can cancel request.")
        if wf_req.fdr:
            enforce_institution_isolation(user=current_user, target_institution_id=wf_req.fdr.institution_id)
        if wf_req.status not in ("REQUESTED", "CORRECTION_REQUIRED"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot cancel request in status '{wf_req.status}'.",
            )
        wf_req.status = "CANCELLED"
        if wf_req.fdr and wf_req.fdr.status in (FDRStatus.RELEASE_REQUESTED.value, FDRStatus.RENEWAL_REQUESTED.value):
            record_status_transition(
                session=session,
                fdr=wf_req.fdr,
                to_status=FDRStatus.ACTIVE.value,
                actor=current_user,
                reason=req.reason or "Workflow request cancelled by applicant",
                request=wf_req,
                transition_type="REQUEST_CANCELLED",
            )
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown transition type: {req.transition_type}")

    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action=f"TRANSITION_{t_type}",
        target_type="REQUEST",
        target_id=str(wf_req.id),
        details=f"Workflow request {wf_req.id} transitioned via {t_type} to {wf_req.status}.",
    )
    session.add(audit)
    session.commit()
    return _serialize_request(wf_req)

