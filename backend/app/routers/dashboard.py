"""
Dashboard & Summary API Router (/api/v1/dashboard).
Implements Section 8.7 of REQUIREMENTS_UPDATED.md with server-side role and institution scoping.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, and_

from app.database import get_db
from app.models.enums import UserRole, FDRStatus
from app.models.fdr import FDR
from app.models.audit import AuditLog
from app.models.user import User
from app.auth import get_current_user

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])


@router.get("/summary", summary="Get dashboard summary metrics scoped by role")
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Returns aggregated counts and total deposit amounts.
    - Institution Officers receive aggregates scoped strictly to their own institution.
    - AICTE Admin, Verifiers, and Approvers receive global aggregates.
    """
    query = session.query(FDR)
    if current_user.role == UserRole.INSTITUTION_OFFICER.value:
        query = query.filter(FDR.institution_id == current_user.institution_id)

    all_fdrs = query.all()
    total_fdrs = len(all_fdrs)
    total_amount = sum(float(f.amount) for f in all_fdrs)

    by_status: Dict[str, int] = {}
    for f in all_fdrs:
        by_status[f.status] = by_status.get(f.status, 0) + 1

    pending_verif = by_status.get(FDRStatus.SUBMITTED.value, 0) + by_status.get(FDRStatus.UNDER_VERIFICATION.value, 0)
    pending_appr = by_status.get(FDRStatus.PENDING_APPROVAL.value, 0)
    active_count = by_status.get(FDRStatus.ACTIVE.value, 0)
    correction_count = by_status.get(FDRStatus.CORRECTION_REQUIRED.value, 0)
    maturing_soon_count = by_status.get(FDRStatus.MATURING_SOON.value, 0)
    matured_count = by_status.get(FDRStatus.MATURED.value, 0)
    pending_review = pending_verif + pending_appr + correction_count

    inst_info = None
    if current_user.institution:
        inst = current_user.institution
        inst_info = {
            "id": inst.id,
            "name": inst.name,
            "aicte_pid": inst.aicte_pid,
            "region": inst.region,
            "city": inst.city,
            "state": inst.state,
            "sponsoring_trust": inst.sponsoring_trust,
            "status": inst.status,
        }

    return {
        "total_fdrs": total_fdrs,
        "by_status": by_status,
        "active_count": active_count,
        "pending_fdr_verification": pending_verif,
        "pending_fdr_approval": pending_appr,
        "pending_review_count": pending_review,
        "correction_required_count": correction_count,
        "maturing_soon_count": maturing_soon_count,
        "matured_count": matured_count,
        "maturing_or_matured_count": maturing_soon_count + matured_count,
        "total_deposit_amount_inr": total_amount,
        "institution_scope": current_user.institution_id if current_user.role == UserRole.INSTITUTION_OFFICER.value else "ALL",
        "institution_info": inst_info,
    }


def _map_activity_meta(action: str):
    act = (action or "").upper()
    if "SUBMIT" in act:
        return {"type": "info", "badge": "Submitted", "icon": "upload_file"}
    elif "VERIF" in act or "SCRUTINY" in act:
        return {"type": "info", "badge": "Review Scrutiny", "icon": "fact_check"}
    elif "APPROV" in act or "ACTIVE" in act:
        return {"type": "success", "badge": "Council Approved", "icon": "check_circle"}
    elif "CORRECTION" in act or "CLARIF" in act or "REJECT" in act:
        return {"type": "warning", "badge": "Action Required", "icon": "edit_document"}
    elif "RENEW" in act or "ROLLOVER" in act:
        return {"type": "info", "badge": "Renewal", "icon": "autorenew"}
    elif "RELEASE" in act or "REFUND" in act:
        return {"type": "success", "badge": "Disbursement", "icon": "payments"}
    elif "DOCUMENT" in act or "UPLOAD" in act:
        return {"type": "info", "badge": "Document Vault", "icon": "description"}
    return {"type": "info", "badge": "System Event", "icon": "history"}


@router.get("/activities", summary="Get recent audit activities for dashboard feed")
def get_dashboard_activities(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Returns recent audit logs formatted for dashboard telemetry.
    Strictly isolated: Institution Officers see only activities related to their own FDRs or user actions.
    """
    query = session.query(AuditLog)
    if current_user.role == UserRole.INSTITUTION_OFFICER.value:
        inst_id = current_user.institution_id
        fdr_ids = [str(f.id) for f in session.query(FDR.id).filter_by(institution_id=inst_id).all()]
        query = query.filter(
            or_(
                AuditLog.actor_id == current_user.id,
                and_(AuditLog.target_type == "FDR", AuditLog.target_id.in_(fdr_ids)),
            )
        )

    logs = query.order_by(desc(AuditLog.created_at)).limit(limit).all()

    # Pre-fetch FDR numbers for clean display
    fdr_id_set = {int(l.target_id) for l in logs if l.target_type == "FDR" and str(l.target_id).isdigit()}
    fdr_map = {}
    if fdr_id_set:
        found_fdrs = session.query(FDR.id, FDR.fdr_number).filter(FDR.id.in_(fdr_id_set)).all()
        fdr_map = {f[0]: f[1] for f in found_fdrs}

    items = []
    for l in logs:
        meta = _map_activity_meta(l.action)
        target_display = f"FDR #{l.target_id}"
        if l.target_type == "FDR" and str(l.target_id).isdigit():
            fdr_num = fdr_map.get(int(l.target_id))
            if fdr_num:
                target_display = fdr_num

        items.append({
            "id": l.id,
            "title": l.action.replace("_", " ").title(),
            "target": target_display,
            "target_type": l.target_type,
            "target_id": l.target_id,
            "desc": l.details or f"Action {l.action} logged by {l.actor_name or 'System'}",
            "date": l.created_at.strftime("%d %b %Y, %I:%M %p") if l.created_at else "—",
            "actor_name": l.actor_name or "System",
            "actor_role": l.actor_role or "SYSTEM",
            "type": meta["type"],
            "badge": meta["badge"],
            "icon": meta["icon"],
        })
    return items


@router.get("/maturity", summary="Get upcoming and matured FDRs scoped by role")
def get_maturity_horizon(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Returns upcoming maturities and matured instruments.
    Scoped by institution for Institution Officers.
    """
    query = session.query(FDR).filter(
        FDR.status.in_([FDRStatus.MATURING_SOON.value, FDRStatus.MATURED.value, FDRStatus.ACTIVE.value])
    )
    if current_user.role == UserRole.INSTITUTION_OFFICER.value:
        query = query.filter(FDR.institution_id == current_user.institution_id)

    items = query.order_by(FDR.maturity_date.asc()).all()
    return [
        {
            "id": f.id,
            "fdr_number": f.fdr_number,
            "institution_id": f.institution_id,
            "institution_name": f.institution.name if f.institution else None,
            "bank_name": f.bank_name,
            "amount": float(f.amount),
            "maturity_date": f.maturity_date,
            "status": f.status,
            "auto_rollover": f.auto_rollover,
        }
        for f in items
    ]
