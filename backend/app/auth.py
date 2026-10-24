"""
Authentication and Authorization Service for AICTE FDR Portal.
Enforces:
- Password verification via PBKDF2
- JWT Bearer token issuance, validation, and revocation
- Role-based access control (RBAC) for the 4 canonical roles:
  * AICTE_ADMIN
  * INSTITUTION_OFFICER
  * VERIFICATION_OFFICER
  * APPROVING_AUTHORITY
- Server-side institution isolation: Institution Officers cannot access cross-institution data
- Principals are derived server-side from tokens; client-supplied role/institution IDs are never trusted
"""

from typing import Optional, Dict, Any, List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.security import (
    verify_password,
    create_access_token,
    decode_access_token,
    revoke_token,
    SecurityError,
    TokenExpiredError,
    InvalidTokenError,
    TokenRevokedError,
)

# Standard Bearer auth scheme
http_bearer = HTTPBearer(auto_error=False)

# Documented development/demo accounts (NOT for production use)
DEMO_ACCOUNTS_METADATA = [
    {
        "role": UserRole.AICTE_ADMIN.value,
        "role_label": "AICTE Admin",
        "username": "admin_sridhar",
        "email": "rk.sridhar@aicte.gov.in",
        "name": "Dr. R. K. Sridhar",
        "title": "Joint Director - Finance",
        "department": "Central Regulatory Financial Custody Division, HQ New Delhi",
        "institution_id": None,
        "institution_name": None,
        "demo_password_hint": "AdminDemo@2026 (Development demo account only)",
    },
    {
        "role": UserRole.INSTITUTION_OFFICER.value,
        "role_label": "Institution Officer (WRO)",
        "username": "officer_deshmukh",
        "email": "anand.deshmukh@stxaviers.edu.in",
        "name": "Dr. Anand Deshmukh",
        "title": "Secretary / Trustee",
        "department": "St. Xavier's Engineering College, Pune (PID: 1-10928374)",
        "institution_id": 1,
        "institution_name": "St. Xavier's Engineering College",
        "demo_password_hint": "OfficerDemo@2026 (Development demo account only)",
    },
    {
        "role": UserRole.INSTITUTION_OFFICER.value,
        "role_label": "Institution Officer (SWRO)",
        "username": "officer_venkatesh",
        "email": "ks.venkatesh@bmsca.edu.in",
        "name": "Dr. K. S. Venkatesh",
        "title": "Principal / Trustee",
        "department": "BMS College of Architecture, Bengaluru (PID: 1-88492011)",
        "institution_id": 2,
        "institution_name": "BMS College of Architecture",
        "demo_password_hint": "OfficerDemo@2026 (Development demo account only)",
    },
    {
        "role": UserRole.VERIFICATION_OFFICER.value,
        "role_label": "Verification Officer",
        "username": "verif_malhotra",
        "email": "vk.malhotra@aicte.gov.in",
        "name": "Shri V. K. Malhotra",
        "title": "Regional Scrutiny Officer",
        "department": "AICTE Western Regional Office (WRO), Pune/Mumbai",
        "institution_id": None,
        "institution_name": None,
        "demo_password_hint": "VerifDemo@2026 (Development demo account only)",
    },
    {
        "role": UserRole.APPROVING_AUTHORITY.value,
        "role_label": "Approving Authority",
        "username": "approver_kumar",
        "email": "rajive.kumar@aicte.gov.in",
        "name": "Prof. Rajive Kumar",
        "title": "Member Secretary / Approving Authority",
        "department": "AICTE Statutory Executive Council, HQ New Delhi",
        "institution_id": None,
        "institution_name": None,
        "demo_password_hint": "ApproverDemo@2026 (Development demo account only)",
    },
]


def authenticate_user(
    session: Session,
    identifier: str,
    password: str,
) -> Optional[User]:
    """
    Verifies user credentials securely by either username or email.
    Returns the User record if valid and active, else None.
    Never exposes or compares plaintext passwords.
    """
    if not identifier or not password:
        return None

    clean_id = identifier.strip().lower()
    user = (
        session.query(User)
        .filter((User.username.ilike(clean_id)) | (User.email.ilike(clean_id)))
        .first()
    )

    if not user or not user.is_active:
        return None

    if not verify_password(password, user.hashed_password):
        return None

    return user


def create_user_session(user: User) -> Dict[str, Any]:
    """
    Creates an access token and standardized authentication session payload.
    Omits all password hashes and sensitive secrets.
    """
    payload = {
        "sub": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "institution_id": user.institution_id,
    }

    token = create_access_token(payload)

    return {
        "access_token": token,
        "token_type": "Bearer",
        "user": {
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "name": user.full_name,
            "role": user.role,
            "institution_id": user.institution_id,
            "institution_name": user.institution.name if user.institution else None,
        },
    }


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    session: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency that extracts, decodes, and verifies the Bearer token.
    Loads the user from the database and ensures they are active.
    Raises 401 if missing, expired, revoked, or invalid.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except TokenExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except TokenRevokedError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has been revoked.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (InvalidTokenError, SecurityError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing subject.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = session.query(User).filter_by(id=user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or has been deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_roles(*allowed_roles: str):
    """
    Dependency factory enforcing role-based access control.
    Raises 403 Forbidden if the authenticated user's role is not in allowed_roles.
    """
    def _role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: role '{current_user.role}' is not authorized for this resource.",
            )
        return current_user

    return _role_checker


def enforce_institution_isolation(user: User, target_institution_id: Optional[int]) -> bool:
    """
    Enforces server-side institution isolation:
    - INSTITUTION_OFFICER can ONLY access resources with matching institution_id.
    - AICTE_ADMIN, VERIFICATION_OFFICER, APPROVING_AUTHORITY have regulatory oversight.
    Raises 403 Forbidden on violation.
    """
    if user.role == UserRole.INSTITUTION_OFFICER.value:
        if user.institution_id is None or user.institution_id != target_institution_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: cannot access or modify resources belonging to another institution.",
            )
    return True


def derive_institution_id(user: User) -> int:
    """
    Derives institution_id directly from the authenticated principal.
    Rejects client attempts to specify another institution ID.
    """
    if user.role == UserRole.INSTITUTION_OFFICER.value:
        if not user.institution_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Institution Officer has no assigned institution.",
            )
        return user.institution_id

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Only Institution Officers operate within a derived institution context.",
    )
