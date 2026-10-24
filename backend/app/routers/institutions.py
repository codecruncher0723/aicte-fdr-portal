"""
Institutions API Router (/api/v1/institutions).
Implements Section 8.2 of REQUIREMENTS_UPDATED.md with strict server-side RBAC and institution isolation:
- AICTE Admin, Verification Officer, and Approving Authority can view authorized institutions.
- Institution Officer can view ONLY their own institution.
- Cross-institution queries by Institution Officers are rejected with 403 Forbidden.
- Unauthenticated requests return 401 Unauthorized.
- PATCH /api/v1/institutions/{id} allows updating institution profile details under strict RBAC.
"""

from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.enums import UserRole
from app.models.institution import Institution
from app.models.user import User
from app.models.audit import AuditLog
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
    contact_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class InstitutionUpdateRequest(BaseModel):
    sponsoring_trust: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None


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


@router.patch("/{institution_id}", response_model=InstitutionResponse, summary="Update institution profile")
def update_institution_profile(
    institution_id: int,
    req: InstitutionUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Updates institution profile attributes (sponsoring trust, location, authorized contact).
    Enforces server-side authentication, role authorization, and institution isolation:
    - INSTITUTION_OFFICER: can only update their own assigned institution. Cross-institution
      updates are rejected with 403 Forbidden.
    - AICTE_ADMIN: can update authorized institutions.
    - VERIFICATION_OFFICER, APPROVING_AUTHORITY: rejected with 403 Forbidden (separation of duties).
    - Unauthenticated requests: rejected with 401 Unauthorized.
    """
    if current_user.role not in [UserRole.INSTITUTION_OFFICER.value, UserRole.AICTE_ADMIN.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Your role is not authorized to edit institutional profile records.",
        )

    enforce_institution_isolation(user=current_user, target_institution_id=institution_id)

    inst = session.query(Institution).filter_by(id=institution_id).first()
    if not inst:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Institution with ID {institution_id} not found.",
        )

    updated_fields = []
    if req.sponsoring_trust is not None and req.sponsoring_trust.strip():
        inst.sponsoring_trust = req.sponsoring_trust.strip()
        updated_fields.append("sponsoring_trust")

    if req.city is not None and req.city.strip():
        inst.city = req.city.strip()
        updated_fields.append("city")

    if req.state is not None and req.state.strip():
        inst.state = req.state.strip()
        updated_fields.append("state")

    # Update associated user contact details if requested
    if req.contact_name is not None and req.contact_name.strip():
        if current_user.role == UserRole.INSTITUTION_OFFICER.value:
            current_user.full_name = req.contact_name.strip()
            updated_fields.append("contact_name")
        else:
            if inst.users:
                inst.users[0].full_name = req.contact_name.strip()
                updated_fields.append("contact_name")

    if req.contact_email is not None and req.contact_email.strip():
        new_email = req.contact_email.strip().lower()
        if current_user.role == UserRole.INSTITUTION_OFFICER.value:
            conflict = session.query(User).filter(User.email == new_email, User.id != current_user.id).first()
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email address '{new_email}' is already in use by another user.",
                )
            current_user.email = new_email
            updated_fields.append("contact_email")
        else:
            if inst.users:
                inst.users[0].email = new_email
                updated_fields.append("contact_email")

    inst.updated_at = datetime.now(timezone.utc)

    # Append regulatory audit log entry
    audit = AuditLog(
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="UPDATE_INSTITUTION_PROFILE",
        target_type="INSTITUTION",
        target_id=str(inst.id),
        details=f"Updated institutional profile for {inst.name} (PID: {inst.aicte_pid}): fields={', '.join(updated_fields) if updated_fields else 'no changes'}",
        ip_address="127.0.0.1",
        created_at=datetime.now(timezone.utc),
    )
    session.add(audit)
    session.commit()
    session.refresh(inst)

    return inst
