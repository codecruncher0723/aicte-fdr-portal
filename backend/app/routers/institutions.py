"""
Institutions API Router (/api/v1/institutions).
Implements Section 8.2 of REQUIREMENTS_UPDATED.md with strict server-side RBAC and institution isolation:
- AICTE Admin, Verification Officer, and Approving Authority can view authorized institutions.
- Institution Officer can view ONLY their own institution.
- Cross-institution queries by Institution Officers are rejected with 403 Forbidden.
- Unauthenticated requests return 401 Unauthorized.
"""

from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.enums import UserRole
from app.models.institution import Institution
from app.models.user import User
from app.auth import get_current_user, enforce_institution_isolation

router = APIRouter(prefix="/api/v1/institutions", tags=["Institutions"])


class InstitutionResponse(BaseModel):
    id: int
    aicte_pid: str
    name: str
    region: str
    state: str
    city: str
    sponsoring_trust: str
    status: str
    fdr_count: Optional[int] = 0
    total_fdr_amount: Optional[float] = 0.0
    contact_email: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=List[InstitutionResponse], summary="List authorized institutions")
def list_institutions(
    search: Optional[str] = Query(None, description="Search term across name, PID, city, state, or trust"),
    region: Optional[str] = Query(None, description="Region code e.g. wro, swro, nro, sro, ero, nwro, cro"),
    status_filter: Optional[str] = Query(None, alias="status", description="Institution status"),
    institution_id: Optional[int] = Query(None, description="Specific institution ID filter"),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Returns institutions scoped by the authenticated user's role:
    - AICTE_ADMIN, VERIFICATION_OFFICER, APPROVING_AUTHORITY: returns all matching institutions.
    - INSTITUTION_OFFICER: returns only their assigned institution.
    """
    if current_user.role == UserRole.INSTITUTION_OFFICER.value:
        if not current_user.institution_id:
            return []
        if institution_id is not None and institution_id != current_user.institution_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You cannot view records from another institution.",
            )
        inst = session.query(Institution).filter_by(id=current_user.institution_id).first()
        if not inst:
            return []
        
        # Apply filters to single institution
        if region and region.lower() != "all" and inst.region.lower() != region.strip().lower():
            return []
        if status_filter and status_filter.lower() != "all" and inst.status.lower() != status_filter.strip().lower():
            return []
        if search and search.strip():
            term = search.strip().lower()
            fields = [inst.name, inst.aicte_pid, inst.city, inst.state, inst.sponsoring_trust]
            if not any(term in (f or "").lower() for f in fields):
                return []
        return [inst]

    # Regulatory oversight roles see all institutions matching query filters
    query = session.query(Institution)
    if institution_id is not None:
        query = query.filter(Institution.id == institution_id)
    if region and region.lower() != "all":
        query = query.filter(func.lower(Institution.region) == region.strip().lower())
    if status_filter and status_filter.lower() != "all":
        query = query.filter(func.lower(Institution.status) == status_filter.strip().lower())
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Institution.name.ilike(term),
                Institution.aicte_pid.ilike(term),
                Institution.city.ilike(term),
                Institution.state.ilike(term),
                Institution.sponsoring_trust.ilike(term),
            )
        )
    return query.order_by(Institution.name.asc()).all()


@router.get("/{institution_id}", response_model=InstitutionResponse, summary="Get institution details")
def get_institution(
    institution_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Returns detail for a specific institution.
    Enforces server-side institution isolation: Institution Officer from Institution A
    attempting to view Institution B is rejected with 403 Forbidden.
    """
    inst = session.query(Institution).filter_by(id=institution_id).first()
    if not inst:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Institution with ID {institution_id} not found.",
        )

    enforce_institution_isolation(user=current_user, target_institution_id=inst.id)
    return inst
