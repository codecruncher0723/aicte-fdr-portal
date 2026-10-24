"""
Forensic Audit Log API Router (/api/v1/audit-logs).
Implements Section 5.4, 8.7, and 11.2 of REQUIREMENTS_UPDATED.md:
- Lists tamper-evident append-only audit trail records from the database.
- Enforces role and institution scoping server-side:
  - Regulatory roles (AICTE_ADMIN, APPROVING_AUTHORITY, VERIFICATION_OFFICER) can view global audit events.
  - Institution Officers can view events only for their own institution or actions.
- Never exposes passwords, private tokens, or encryption keys.
"""

import csv
import io
import hashlib
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, and_

from app.database import get_db
from app.models.enums import UserRole
from app.models.audit import AuditLog
from app.models.fdr import FDR
from app.models.user import User
from app.auth import get_current_user

router = APIRouter(prefix="/api/v1/audit-logs", tags=["Audit Logs"])


def _compute_audit_digest(log: AuditLog) -> str:
    """Generates deterministic SHA-256 block digest for tamper-evidence representation."""
    raw = f"{log.id}|{log.action}|{log.target_type}:{log.target_id}|{log.created_at}|{log.details or ''}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"sha256:{digest[:12]}...{digest[-4:]}"


def _format_audit_log(log: AuditLog) -> dict:
    return {
        "id": log.id,
        "action": log.action,
        "actor_id": log.actor_id,
        "actor_name": log.actor_name or "System",
        "actor_role": log.actor_role or "SYSTEM",
        "target_type": log.target_type,
        "target_id": log.target_id,
        "details": log.details or "",
        "created_at": log.created_at.isoformat() if log.created_at else None,
        "hash": _compute_audit_digest(log),
    }


def _get_scoped_audit_query(current_user: User, session: Session):
    query = session.query(AuditLog)
    if current_user.role == UserRole.INSTITUTION_OFFICER.value:
        inst_id = current_user.institution_id
        # Own FDR IDs
        fdr_ids = [str(f.id) for f in session.query(FDR.id).filter_by(institution_id=inst_id).all()]
        query = query.filter(
            or_(
                AuditLog.actor_id == current_user.id,
                and_(AuditLog.target_type == "FDR", AuditLog.target_id.in_(fdr_ids)),
            )
        )
    return query


@router.get("", summary="List audit logs scoped by authenticated role and institution")
def list_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    action: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    target_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Returns audit trail records from the database.
    - AICTE Admin, Approver, and Verifier can see system-wide audit records.
    - Institution Officers can only see audit records for their institution's FDRs or actions.
    """
    query = _get_scoped_audit_query(current_user, session)

    if action and action.lower() != "all":
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if role and role.lower() != "all":
        query = query.filter(AuditLog.actor_role.ilike(f"%{role}%"))
    if target_id:
        query = query.filter(AuditLog.target_id.ilike(f"%{target_id}%"))

    logs = query.order_by(desc(AuditLog.created_at)).limit(limit).all()
    return [_format_audit_log(l) for l in logs]


@router.get("/export.csv", summary="Export audit trail records as CSV")
def export_audit_logs_csv(
    action: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Generates CSV export of authorized audit logs from the database.
    Enforces server-side scoping and prevents leakage of sensitive artifacts.
    """
    query = _get_scoped_audit_query(current_user, session)

    if action and action.lower() != "all":
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if role and role.lower() != "all":
        query = query.filter(AuditLog.actor_role.ilike(f"%{role}%"))

    logs = query.order_by(desc(AuditLog.created_at)).limit(500).all()

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # Header
    writer.writerow([
        "Log ID",
        "Timestamp (UTC)",
        "Actor Name",
        "Actor Role",
        "Action",
        "Target Type",
        "Target ID",
        "Forensic Details / Remarks",
        "Cryptographic Digest",
    ])

    for l in logs:
        writer.writerow([
            l.id,
            l.created_at.isoformat() if l.created_at else "",
            l.actor_name or "System",
            l.actor_role or "SYSTEM",
            l.action,
            l.target_type,
            l.target_id,
            l.details or "",
            _compute_audit_digest(l),
        ])

    csv_data = output.getvalue()
    output.close()

    filename = f"AICTE_Audit_Trail_{current_user.role}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
