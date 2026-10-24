"""
CSV Reports Export API Router (/api/v1/reports).
Implements Section 5.3 & 8.7 of REQUIREMENTS_UPDATED.md:
- Exports filtered FDR data as clean CSV.
- Enforces role and institution scoping server-side.
- Never exports passwords, tokens, private storage keys, or raw contents.
"""

import csv
import io
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.enums import UserRole
from app.models.fdr import FDR
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

    if status_filter:
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
            format(Decimal(str(f.amount)).quantize(Decimal("0.01")), "f"),
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
