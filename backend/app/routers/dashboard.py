"""
Dashboard & Summary API Router (/api/v1/dashboard).
Implements Section 8.7 of REQUIREMENTS_UPDATED.md with server-side role and institution scoping.
"""

from decimal import Decimal
from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc

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
    total_amount = sum((Decimal(str(f.amount)) for f in all_fdrs), Decimal("0.00"))

    by_status: Dict[str, int] = {}
    for f in all_fdrs:
        by_status[f.status] = by_status.get(f.status, 0) + 1

    pending_verif = by_status.get(FDRStatus.SUBMITTED.value, 0) + by_status.get(FDRStatus.UNDER_VERIFICATION.value, 0)
    pending_appr = by_status.get(FDRStatus.PENDING_APPROVAL.value, 0)

    return {
        "total_fdrs": total_fdrs,
        "by_status": by_status,
        "pending_fdr_verification": pending_verif,
        "pending_fdr_approval": pending_appr,
        "total_deposit_amount_inr": format(total_amount.quantize(Decimal("0.01")), "f"),
        "institution_scope": current_user.institution_id if current_user.role == UserRole.INSTITUTION_OFFICER.value else "ALL",
    }


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
            "amount": format(Decimal(str(f.amount)).quantize(Decimal("0.01")), "f"),
            "maturity_date": f.maturity_date,
            "status": f.status,
            "auto_rollover": f.auto_rollover,
        }
        for f in items
    ]


@router.get("/audit-logs", summary="List audit events scoped by role")
def list_audit_logs(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    query = session.query(AuditLog)
    if current_user.role == UserRole.INSTITUTION_OFFICER.value:
        fdr_ids = [
            str(row.id)
            for row in session.query(FDR.id).filter(FDR.institution_id == current_user.institution_id).all()
        ]
        query = query.filter(
            (AuditLog.actor_id == current_user.id)
            | ((AuditLog.target_type == "FDR") & (AuditLog.target_id.in_(fdr_ids or ["-1"])))
        )
    logs = query.order_by(desc(AuditLog.created_at)).limit(500).all()
    return [
        {
            "id": log.id,
            "timestamp": log.created_at.isoformat() if log.created_at else None,
            "actor": log.actor_name,
            "role": log.actor_role,
            "action": log.action,
            "target": f"{log.target_type}:{log.target_id}",
            "details": log.details,
            "hash": None,
        }
        for log in logs
    ]
