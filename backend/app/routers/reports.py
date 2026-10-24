"""
CSV Reports Export API Router (/api/v1/reports).
Implements Section 5.3 & 8.7 of REQUIREMENTS_UPDATED.md:
- Exports filtered FDR data as clean CSV.
- Exports filtered workflow requests (renewal/release) as clean CSV.
- Enforces role and institution scoping server-side.
- Never exports passwords, tokens, private storage keys, or raw contents.
"""

import csv
import io
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.enums import UserRole
from app.models.fdr import FDR
from app.models.workflow import WorkflowRequest
from app.models.user import User
from app.auth import get_current_user

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])


@router.get("/fdrs.csv", summary="Export authorized FDR records as CSV")
def export_fdrs_csv(
    status_filter: Optional[str] = Query(None, alias="status"),
    institution_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Generates CSV export of authorized FDR records.
    - Institution Officers can export ONLY their own institution's FDRs.
    - AICTE Admin, Verifiers, and Approvers can export across institutions.
    - Excludes sensitive security artifacts.
    """
    query = session.query(FDR)

    if current_user.role == UserRole.INSTITUTION_OFFICER.value:
        if institution_id is not None and institution_id != current_user.institution_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: cannot export FDRs from another institution.",
            )
        query = query.filter(FDR.institution_id == current_user.institution_id)
    else:
        if institution_id is not None:
            query = query.filter(FDR.institution_id == institution_id)

    if status_filter and status_filter.lower() != "all":
        query = query.filter(FDR.status == status_filter)

    fdrs = query.order_by(FDR.id.asc()).all()

    # Generate CSV stream
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "fdr_id",
        "fdr_number",
        "cert_number",
        "tripartite_ref",
        "institution_id",
        "institution_name",
        "bank_name",
        "branch",
        "ifsc",
        "amount_inr",
        "interest_rate",
        "issue_date",
        "maturity_date",
        "status",
        "lien_status",
    ])

    for f in fdrs:
        writer.writerow([
            f.id,
            f.fdr_number,
            f.cert_number or "",
            f.tripartite_ref or "",
            f.institution_id,
            f.institution.name if f.institution else "",
            f.bank_name,
            f.branch,
            f.ifsc,
            float(f.amount),
            f.interest_rate or "",
            f.issue_date.isoformat() if f.issue_date else "",
            f.maturity_date.isoformat() if f.maturity_date else "",
            f.status,
            f.lien_status or "",
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="aicte_fdr_export.csv"'},
    )


@router.get("/requests.csv", summary="Export authorized workflow requests as CSV")
def export_requests_csv(
    request_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    institution_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Generates CSV export of authorized renewal and release workflow requests.
    - Institution Officers can export ONLY requests for their own institution's FDRs.
    - AICTE Admin, Verifiers, and Approvers can export across institutions.
    """
    query = session.query(WorkflowRequest).join(FDR, WorkflowRequest.fdr_id == FDR.id)

    if current_user.role == UserRole.INSTITUTION_OFFICER.value:
        if institution_id is not None and institution_id != current_user.institution_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: cannot export requests from another institution.",
            )
        query = query.filter(FDR.institution_id == current_user.institution_id)
    else:
        if institution_id is not None:
            query = query.filter(FDR.institution_id == institution_id)

    if request_type and request_type.lower() != "all":
        query = query.filter(WorkflowRequest.request_type == request_type)
    if status_filter and status_filter.lower() != "all":
        query = query.filter(WorkflowRequest.status == status_filter)

    requests = query.order_by(WorkflowRequest.id.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "request_id",
        "fdr_id",
        "fdr_number",
        "institution_id",
        "institution_name",
        "request_type",
        "status",
        "reason",
        "council_order_ref",
        "confirmation_reference",
        "created_at",
        "updated_at",
    ])

    for r in requests:
        writer.writerow([
            r.id,
            r.fdr_id,
            r.fdr.fdr_number if r.fdr else "",
            r.fdr.institution_id if r.fdr else "",
            r.fdr.institution.name if r.fdr and r.fdr.institution else "",
            r.request_type,
            r.status,
            r.reason or "",
            r.council_order_ref or "",
            r.confirmation_reference or "",
            r.created_at.isoformat() if r.created_at else "",
            r.updated_at.isoformat() if r.updated_at else "",
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="aicte_requests_export.csv"'},
    )
