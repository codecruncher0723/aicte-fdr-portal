"""
Authentication API Router (/api/v1/auth).
Endpoints:
- POST /api/v1/auth/login: Authenticate user & issue JWT Bearer token
- POST /api/v1/auth/logout: Revoke active session token
- GET  /api/v1/auth/me: Retrieve authenticated user profile & scope
- GET  /api/v1/auth/demo-accounts: Development demo accounts metadata
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.auth import (
    authenticate_user,
    create_user_session,
    get_current_user,
    http_bearer,
    DEMO_ACCOUNTS_METADATA,
)
from app.security import revoke_token

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: Optional[str] = Field(None, description="Email address of the user")
    username: Optional[str] = Field(None, description="Username of the user")
    password: str = Field(..., min_length=1, description="Password")


class UserProfileResponse(BaseModel):
    user_id: int
    username: str
    email: str
    name: str
    role: str
    institution_id: Optional[int] = None
    institution_name: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    user: UserProfileResponse


@router.post("/login", response_model=LoginResponse, summary="Authenticate user and obtain JWT token")
def login(
    req: LoginRequest,
    session: Session = Depends(get_db),
):
    identifier = req.username or req.email
    if not identifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either username or email must be provided.",
        )

    user = authenticate_user(session, identifier=identifier, password=req.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return create_user_session(user)


@router.post("/logout", summary="Invalidate active token and end session")
def logout(
    current_user: User = Depends(get_current_user),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
):
    if credentials and credentials.credentials:
        revoke_token(credentials.credentials)
    return {"message": "Logged out successfully", "user_id": current_user.id}


@router.get("/me", response_model=UserProfileResponse, summary="Get current authenticated user profile")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "name": current_user.full_name,
        "role": current_user.role,
        "institution_id": current_user.institution_id,
        "institution_name": current_user.institution.name if current_user.institution else None,
    }


@router.get("/demo-accounts", summary="List development demo accounts")
def list_demo_accounts():
    """Returns safe metadata for demo accounts without exposing real secrets."""
    return {
        "mode": "DEVELOPMENT_DEMO_ONLY",
        "description": "Predefined development accounts for evaluation across the 4 roles.",
        "accounts": DEMO_ACCOUNTS_METADATA,
    }
