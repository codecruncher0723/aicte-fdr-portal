"""
Append-Only Verification, Approval, and Status History Service for AICTE FDR Portal.

Enforces:
- Append-only recording of all verification decisions, approval decisions, and status transitions.
- Recording actor, timestamp, previous status, new status, and remarks/reasons.
- Strict preservation of prior FDR values and immutable document versions on renewal.
- Separation of duties: Submitter CANNOT approve or verify their own submission.
- Role-based workflow validation (VERIFICATION_OFFICER, APPROVING_AUTHORITY).
- Database-level immutability preventing updates or deletions of historical records.
"""

from datetime import datetime, timezone
from typing import Optional, Any, List, Dict
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.models.enums import UserRole, FDRStatus, RequestType, RenewalStatus, ReleaseStatus, ProvenanceSource
from app.models.fdr import FDR, FieldProvenance, FDRRenewalHistory
from app.models.user import User
from app.models.workflow import WorkflowRequest, VerificationRecord, ApprovalRecord, StatusTransitionHistory
from app.models.audit import AuditLog
from app.models.document import DocumentVersion


class HistoryError(Exception):
    """Base exception for workflow and history operations."""
    pass


class SeparationOfDutiesError(HistoryError):
    """Raised when a user attempts to approve or verify their own submission."""
    pass


class UnauthorizedRoleError(HistoryError):
    """Raised when an actor lacks the required role for a workflow action."""
    pass


class InvalidStatusTransitionError(HistoryError):
    """Raised when an invalid status transition is attempted."""
    pass


class ImmutableRecordError(HistoryError):
    """Raised when an append-only historical record is updated or deleted."""
    pass


# Register immutability listeners once on the models
_IMMUTABILITY_REGISTERED = False

def register_immutability_listeners():
    """
    Registers SQLAlchemy event listeners on historical models to enforce
    that records are strictly append-only and can never be updated or deleted.
    """
    global _IMMUTABILITY_REGISTERED
    if _IMMUTABILITY_REGISTERED:
        return

    models = [VerificationRecord, ApprovalRecord, StatusTransitionHistory, FDRRenewalHistory, FieldProvenance, DocumentVersion]
    for model in models:
        @event.listens_for(model, "before_update")
        def _prevent_update(mapper, connection, target):
            raise ImmutableRecordError(
                f"{target.__class__.__name__} records are append-only and cannot be modified."
            )

        @event.listens_for(model, "before_delete")
        def _prevent_delete(mapper, connection, target):
            raise ImmutableRecordError(
                f"{target.__class__.__name__} records are append-only and cannot be deleted."
            )

    _IMMUTABILITY_REGISTERED = True


# Auto-register on import
register_immutability_listeners()


def record_status_transition(
    session: Session,
    fdr: FDR,
    to_status: str,
    actor: User,
    reason: Optional[str] = None,
    request: Optional[WorkflowRequest] = None,
    transition_type: str = "FDR_LIFECYCLE",
) -> StatusTransitionHistory:
    """
    Atomically updates the FDR status and records an immutable StatusTransitionHistory record.
    Also creates an entry in AuditLog.
    """
    from_status = fdr.status
    fdr.status = to_status

    transition = StatusTransitionHistory(
        fdr_id=fdr.id,
        request_id=request.id if request else None,
        actor_id=actor.id,
        from_status=from_status,
        to_status=to_status,
        transition_type=transition_type,
        reason=reason,
    )
    session.add(transition)

    audit = AuditLog(
        actor_id=actor.id,
        actor_name=actor.full_name,
        actor_role=actor.role,
        action=f"STATUS_TRANSITION_{to_status}",
        target_type="FDR",
        target_id=str(fdr.id),
        details=f"Status transitioned from {from_status} to {to_status}. Reason: {reason or 'N/A'}",
    )
    session.add(audit)
    session.flush()
    return transition


def record_verification_decision(
    session: Session,
    officer: User,
    decision: str,  # VERIFIED, CORRECTION_REQUIRED, REJECTED
    fdr: Optional[FDR] = None,
    request: Optional[WorkflowRequest] = None,
    remarks: Optional[str] = None,
    discrepancy_code: Optional[str] = None,
    discrepancy_severity: Optional[str] = None,
    discrepancy_note: Optional[str] = None,
) -> VerificationRecord:
    """
    Records a verification decision with separation of duties enforcement
    and transactional status updates.
    """
    target = fdr or request
    if not target:
        raise ValueError("Must provide either fdr or request for verification.")

    # 1. Separation of duties: submitter cannot verify their own submission
    submitter_id = target.created_by_id
    if submitter_id is not None and officer.id == submitter_id:
        raise SeparationOfDutiesError(
            "Separation of duties violation: Submitter cannot verify their own submission."
        )

    # 2. Role enforcement: VERIFICATION_OFFICER or AICTE_ADMIN
    if officer.role not in (UserRole.VERIFICATION_OFFICER.value, UserRole.AICTE_ADMIN.value):
        raise UnauthorizedRoleError(
            f"User with role '{officer.role}' is not authorized to verify submissions."
        )

    previous_status = target.status
    if decision not in ("VERIFIED", "CORRECTION_REQUIRED", "REJECTED"):
        raise ValueError(f"Invalid verification decision: {decision}")

    # 3. Determine new status
    if fdr is not None and request is None:
        if decision == "VERIFIED":
            new_status = FDRStatus.PENDING_APPROVAL.value
        elif decision == "CORRECTION_REQUIRED":
            new_status = FDRStatus.CORRECTION_REQUIRED.value
        else:
            new_status = FDRStatus.REJECTED.value

        record_status_transition(
            session=session,
            fdr=fdr,
            to_status=new_status,
            actor=officer,
            reason=remarks or f"Verification decision: {decision}",
            transition_type="FDR_VERIFICATION",
        )
    elif request is not None:
        if decision == "VERIFIED":
            new_status = "PENDING_APPROVAL"
        elif decision == "CORRECTION_REQUIRED":
            new_status = "CORRECTION_REQUIRED"
        else:
            new_status = "REJECTED"

        request.status = new_status
        if request.fdr and decision == "CORRECTION_REQUIRED":
            pass  # FDR status preserved

    # 4. Create immutable VerificationRecord
    v_rec = VerificationRecord(
        fdr_id=fdr.id if fdr else (request.fdr_id if request else None),
        request_id=request.id if request else None,
        officer_id=officer.id,
        decision=decision,
        previous_status=previous_status,
        new_status=new_status,
        remarks=remarks,
        discrepancy_code=discrepancy_code,
        discrepancy_severity=discrepancy_severity,
        discrepancy_note=discrepancy_note,
    )
    session.add(v_rec)
    session.flush()
    return v_rec


def record_approval_decision(
    session: Session,
    approver: User,
    decision: str,  # APPROVED, REJECTED, RELEASE_APPROVED
    fdr: Optional[FDR] = None,
    request: Optional[WorkflowRequest] = None,
    council_order_ref: Optional[str] = None,
    reason: Optional[str] = None,
) -> ApprovalRecord:
    """
    Records an approval or rejection decision.
    Strictly enforces:
    - Approver role must be APPROVING_AUTHORITY or AICTE_ADMIN.
    - Separation of duties: Submitter CANNOT approve their own submission.
    - Exactly one of fdr_id or request_id is set per approval record.
    """
    target = fdr or request
    if not target:
        raise ValueError("Must provide either fdr or request for approval.")

    # 1. Separation of duties: Submitter CANNOT approve their own submission
    submitter_id = target.created_by_id
    if submitter_id is not None and approver.id == submitter_id:
        raise SeparationOfDutiesError(
            "Separation of duties violation: Submitter cannot approve their own submission."
        )

    # 2. Role enforcement: APPROVING_AUTHORITY or AICTE_ADMIN
    if approver.role not in (UserRole.APPROVING_AUTHORITY.value, UserRole.AICTE_ADMIN.value):
        raise UnauthorizedRoleError(
            f"User with role '{approver.role}' is not authorized to approve submissions."
        )

    previous_status = target.status

    if fdr is not None and request is None:
        # Initial FDR approval
        if decision == "APPROVED":
            new_status = FDRStatus.ACTIVE.value
        elif decision == "REJECTED":
            new_status = FDRStatus.REJECTED.value
        else:
            raise ValueError(f"Invalid approval decision for FDR: {decision}")

        record_status_transition(
            session=session,
            fdr=fdr,
            to_status=new_status,
            actor=approver,
            reason=reason or f"Approval decision: {decision}",
            transition_type="FDR_APPROVAL",
        )
        appr_rec = ApprovalRecord(
            fdr_id=fdr.id,
            request_id=None,
            approver_id=approver.id,
            decision=decision,
            previous_status=previous_status,
            new_status=new_status,
            council_order_ref=council_order_ref,
            reason=reason,
        )
    elif request is not None:
        if request.request_type == RequestType.RENEWAL.value:
            if decision == "APPROVED":
                new_status = RenewalStatus.APPROVED.value
                # Invariant: Underlying FDR is NOT updated until explicit completion!
            elif decision == "REJECTED":
                new_status = RenewalStatus.REJECTED.value
                # Invariant: Rejected renewal request does not set FDR to REJECTED!
            else:
                raise ValueError(f"Invalid renewal approval decision: {decision}")
        elif request.request_type == RequestType.RELEASE_REFUND.value:
            if decision in ("APPROVED", "RELEASE_APPROVED"):
                decision = "RELEASE_APPROVED"
                new_status = ReleaseStatus.RELEASE_APPROVED.value
                # Invariant: Underlying FDR transitions to RELEASE_APPROVED
                if request.fdr:
                    record_status_transition(
                        session=session,
                        fdr=request.fdr,
                        to_status=FDRStatus.RELEASE_APPROVED.value,
                        actor=approver,
                        reason=reason or "Release request approved",
                        request=request,
                        transition_type="RELEASE_WORKFLOW",
                    )
            elif decision == "REJECTED":
                new_status = ReleaseStatus.REJECTED.value
                # Invariant: Rejected release request does not reject underlying FDR!
            else:
                raise ValueError(f"Invalid release approval decision: {decision}")
        else:
            raise ValueError(f"Unknown request type: {request.request_type}")

        request.status = new_status
        appr_rec = ApprovalRecord(
            fdr_id=None,
            request_id=request.id,
            approver_id=approver.id,
            decision=decision,
            previous_status=previous_status,
            new_status=new_status,
            council_order_ref=council_order_ref,
            reason=reason,
        )

    session.add(appr_rec)
    session.flush()
    return appr_rec


def complete_fdr_renewal(
    session: Session,
    request: WorkflowRequest,
    actor: User,
    renewed_fdr_number: str,
    renewed_maturity_date: Any,
    renewal_document_id: Optional[int] = None,
    renewed_interest_rate: Optional[str] = None,
    remarks: Optional[str] = None,
) -> FDRRenewalHistory:
    """
    Completes an approved renewal request:
    - Retains previous FDR values in FDRRenewalHistory
    - Records FieldProvenance for changed fields
    - Leaves old document versions intact and immutable
    - Updates FDR to ACTIVE with new maturity date and number
    - Updates request to COMPLETED
    - Records status transition
    """
    if request.request_type != RequestType.RENEWAL.value:
        raise ValueError("Cannot complete renewal on a non-renewal request.")
    if request.status != RenewalStatus.APPROVED.value:
        raise InvalidStatusTransitionError(
            f"Cannot complete renewal from status '{request.status}'. Request must be 'APPROVED'."
        )

    fdr = request.fdr
    if not fdr:
        raise ValueError("Renewal request must be linked to an FDR.")

    # 1. Snapshot previous values
    history_entry = FDRRenewalHistory(
        fdr_id=fdr.id,
        request_id=request.id,
        actor_id=actor.id,
        previous_fdr_number=fdr.fdr_number,
        previous_amount=fdr.amount,
        previous_issue_date=fdr.issue_date,
        previous_maturity_date=fdr.maturity_date,
        previous_bank_name=fdr.bank_name,
        previous_branch=fdr.branch,
        previous_interest_rate=fdr.interest_rate,
        renewed_fdr_number=renewed_fdr_number,
        renewed_maturity_date=renewed_maturity_date,
        renewed_interest_rate=renewed_interest_rate or fdr.interest_rate,
        renewal_document_id=renewal_document_id,
        remarks=remarks,
    )
    session.add(history_entry)

    # 2. Record FieldProvenance for audit
    if fdr.fdr_number != renewed_fdr_number:
        session.add(FieldProvenance(
            fdr_id=fdr.id,
            field_name="fdr_number",
            old_value=str(fdr.fdr_number),
            new_value=str(renewed_fdr_number),
            source_category=ProvenanceSource.OFFICER_CORRECTED.value,
            actor_id=actor.id,
            reason=remarks or "Renewal update",
        ))
    if str(fdr.maturity_date) != str(renewed_maturity_date):
        session.add(FieldProvenance(
            fdr_id=fdr.id,
            field_name="maturity_date",
            old_value=str(fdr.maturity_date),
            new_value=str(renewed_maturity_date),
            source_category=ProvenanceSource.OFFICER_CORRECTED.value,
            actor_id=actor.id,
            reason=remarks or "Renewal maturity extension",
        ))

    # 3. Update FDR and request
    fdr.fdr_number = renewed_fdr_number
    fdr.maturity_date = renewed_maturity_date
    if renewed_interest_rate:
        fdr.interest_rate = renewed_interest_rate

    record_status_transition(
        session=session,
        fdr=fdr,
        to_status=FDRStatus.ACTIVE.value,
        actor=actor,
        reason=remarks or "Renewal completed",
        request=request,
        transition_type="RENEWAL_COMPLETION",
    )
    request.status = RenewalStatus.COMPLETED.value
    session.flush()
    return history_entry


def get_fdr_timeline(session: Session, fdr_id: int) -> List[Dict[str, Any]]:
    """
    Returns a unified, chronologically ordered timeline of all transitions,
    verifications, approvals, and renewals for the FDR.
    """
    transitions = session.query(StatusTransitionHistory).filter_by(fdr_id=fdr_id).all()
    verifications = session.query(VerificationRecord).filter_by(fdr_id=fdr_id).all()
    approvals = session.query(ApprovalRecord).filter_by(fdr_id=fdr_id).all()
    renewals = session.query(FDRRenewalHistory).filter_by(fdr_id=fdr_id).all()

    events = []
    for t in transitions:
        events.append({
            "type": "TRANSITION",
            "timestamp": t.created_at,
            "actor_id": t.actor_id,
            "details": f"Status changed from {t.from_status} to {t.to_status}",
            "reason": t.reason,
        })
    for v in verifications:
        events.append({
            "type": "VERIFICATION",
            "timestamp": v.created_at,
            "actor_id": v.officer_id,
            "decision": v.decision,
            "remarks": v.remarks,
        })
    for a in approvals:
        events.append({
            "type": "APPROVAL",
            "timestamp": a.created_at,
            "actor_id": a.approver_id,
            "decision": a.decision,
            "reason": a.reason,
            "council_order_ref": a.council_order_ref,
        })
    for r in renewals:
        events.append({
            "type": "RENEWAL",
            "timestamp": r.created_at,
            "actor_id": r.actor_id,
            "previous_fdr_number": r.previous_fdr_number,
            "renewed_fdr_number": r.renewed_fdr_number,
            "previous_maturity_date": str(r.previous_maturity_date),
            "renewed_maturity_date": str(r.renewed_maturity_date),
            "remarks": r.remarks,
        })

    events.sort(key=lambda x: x["timestamp"])
    return events
