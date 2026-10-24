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
from fastapi import APIRouter, Depends, HTTPException, status
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

    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=List[InstitutionResponse], summary="List authorized institutions")
def list_institutions(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """
    Returns institutions scoped by the authenticated user's role:
    - AICTE_ADMIN, VERIFICATION_OFFICER, APPROVING_AUTHORITY: returns all active institutions.
    - INSTITUTION_OFFICER: returns only their assigned institution.
    """
    if current_user.role == UserRole.INSTITUTION_OFFICER.value:
        if not current_user.institution_id:
            return []
        inst = session.query(Institution).filter_by(id=current_user.institution_id).first()
        return [inst] if inst else []

    # Regulatory oversight roles see all institutions
    return session.query(Institution).all()


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
