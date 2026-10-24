"""
Unit and API integration tests for Authentication and Authorization.
Verifies:
- PBKDF2 password hashing & verification
- RFC 7519 HS256 JWT creation, verification, expiration, and revocation
- All four seeded demo account logins via POST /api/v1/auth/login
- GET /api/v1/auth/me profile retrieval
- POST /api/v1/auth/logout and token invalidation
- Rejection of invalid credentials, expired tokens, and tampered tokens
- Role-based authorization guards (require_roles)
- Server-side institution isolation (enforce_institution_isolation)
- Prevention of client-side institution ID forgery
"""

import time
from datetime import timedelta
import pytest
from fastapi import FastAPI, Depends, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.models.enums import UserRole
from app.models.institution import Institution
from app.models.user import User
from app.migrations.runner import apply_migrations
from app.seeds import seed_database
from app.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    revoke_token,
    is_token_revoked,
    TokenExpiredError,
    InvalidTokenError,
    TokenRevokedError,
)
from app.auth import (
    authenticate_user,
    create_user_session,
    get_current_user,
    require_roles,
    enforce_institution_isolation,
    derive_institution_id,
)
from app.main import app


import os
import tempfile

@pytest.fixture(scope="module")
def test_db():
    """Initializes temporary database with migrations and seeded demo accounts."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    apply_migrations(engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    seed_database(session)
    session.close()

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield engine, TestingSession
    app.dependency_overrides.clear()
    engine.dispose()
    try:
        if os.path.exists(db_path):
            os.remove(db_path)
    except Exception:
        pass


@pytest.fixture
def client(test_db):
    """Provides FastAPI TestClient wired to the seeded test database."""
    return TestClient(app)


# -----------------------------------------------------------------------------
# 1. Password Hashing & Verification Tests
# -----------------------------------------------------------------------------

def test_password_hashing_and_verification():
    """Verifies that PBKDF2 hashing is non-deterministic (salted) and verifies correctly."""
    plain = "SuperSecretPassword@2026"
    hash1 = hash_password(plain)
    hash2 = hash_password(plain)

    # Hashes must differ due to random salt
    assert hash1 != hash2
    assert hash1 != plain
    assert hash1.startswith("pbkdf2:sha256:100000$")

    # Correct password verifies
    assert verify_password(plain, hash1) is True
    assert verify_password(plain, hash2) is True

    # Wrong password fails
    assert verify_password("WrongPassword@123", hash1) is False
    assert verify_password("", hash1) is False


# -----------------------------------------------------------------------------
# 2. JWT Token Encoding, Decoding, and Expiry Tests
# -----------------------------------------------------------------------------

def test_jwt_token_creation_and_decoding():
    """Verifies that create_access_token generates valid HS256 tokens."""
    payload = {"sub": 42, "username": "test_user", "role": "AICTE_ADMIN"}
    token = create_access_token(payload, expires_delta=timedelta(minutes=15))

    decoded = decode_access_token(token)
    assert decoded["sub"] == 42
    assert decoded["username"] == "test_user"
    assert decoded["role"] == "AICTE_ADMIN"
    assert "exp" in decoded
    assert "jti" in decoded


def test_expired_jwt_token_rejected():
    """Verifies that tokens with past expiration raise TokenExpiredError."""
    payload = {"sub": 10, "username": "expired_user"}
    # Token expired 1 minute ago
    token = create_access_token(payload, expires_delta=timedelta(seconds=-60))

    with pytest.raises(TokenExpiredError, match="Token has expired"):
        decode_access_token(token)


def test_tampered_jwt_token_rejected():
    """Verifies that signature alteration or payload tampering raises InvalidTokenError."""
    token = create_access_token({"sub": 1, "role": "INSTITUTION_OFFICER"})
    parts = token.split(".")

    # Tamper with signature
    tampered_sig = parts[0] + "." + parts[1] + ".invalid_sig"
    with pytest.raises(InvalidTokenError):
        decode_access_token(tampered_sig)

    # Tamper with header/payload
    tampered_payload = "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiA5OTl9." + parts[2]
    with pytest.raises(InvalidTokenError):
        decode_access_token(tampered_payload)


def test_token_revocation():
    """Verifies that revoking a token prevents future decoding."""
    token = create_access_token({"sub": 5, "username": "logout_user"})
    decoded = decode_access_token(token)
    jti = decoded["jti"]

    assert is_token_revoked(jti) is False

    # Revoke token
    revoke_token(token)
    assert is_token_revoked(jti) is True

    with pytest.raises(TokenRevokedError, match="Token has been revoked"):
        decode_access_token(token)


# -----------------------------------------------------------------------------
# 3. Demo Account Logins Across All Four Roles
# -----------------------------------------------------------------------------

@pytest.mark.parametrize(
    "identifier,password,expected_role,expected_inst_pid",
    [
        ("admin_sridhar", "AdminDemo@2026", UserRole.AICTE_ADMIN.value, None),
        ("rk.sridhar@aicte.gov.in", "AdminDemo@2026", UserRole.AICTE_ADMIN.value, None),
        ("officer_deshmukh", "OfficerDemo@2026", UserRole.INSTITUTION_OFFICER.value, "1-10928374"),
        ("anand.deshmukh@stxaviers.edu.in", "OfficerDemo@2026", UserRole.INSTITUTION_OFFICER.value, "1-10928374"),
        ("officer_venkatesh", "OfficerDemo@2026", UserRole.INSTITUTION_OFFICER.value, "1-88492011"),
        ("verif_malhotra", "VerifDemo@2026", UserRole.VERIFICATION_OFFICER.value, None),
        ("approver_kumar", "ApproverDemo@2026", UserRole.APPROVING_AUTHORITY.value, None),
    ],
)
def test_demo_accounts_login_success(client, identifier, password, expected_role, expected_inst_pid):
    """Verifies that all 4 canonical roles and demo accounts log in successfully."""
    response = client.post(
        "/api/v1/auth/login",
        json={"username": identifier, "password": password},
    )
    assert response.status_code == 200, f"Login failed for {identifier}: {response.text}"
    data = response.json()

    assert "access_token" in data
    assert data["token_type"] == "Bearer"
    user_info = data["user"]

    assert user_info["role"] == expected_role
    assert "hashed_password" not in user_info
    assert "password" not in user_info

    if expected_inst_pid:
        assert user_info["institution_id"] is not None
    else:
        assert user_info["institution_id"] is None


def test_invalid_login_credentials_rejected(client):
    """Verifies that invalid password or username returns 401 Unauthorized."""
    # Wrong password
    resp1 = client.post(
        "/api/v1/auth/login",
        json={"username": "admin_sridhar", "password": "WrongPassword123"},
    )
    assert resp1.status_code == 401
    assert "Invalid username or password" in resp1.json()["detail"]

    # Non-existent user
    resp2 = client.post(
        "/api/v1/auth/login",
        json={"username": "ghost_user", "password": "AnyPassword"},
    )
    assert resp2.status_code == 401

    # Missing fields
    resp3 = client.post(
        "/api/v1/auth/login",
        json={"password": "PasswordOnly"},
    )
    assert resp3.status_code == 400


# -----------------------------------------------------------------------------
# 4. Profile & Logout API Integration Tests
# -----------------------------------------------------------------------------

def test_get_me_endpoint(client):
    """Verifies GET /api/v1/auth/me returns the authenticated user's profile."""
    # 1. Login to get token
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "officer_deshmukh", "password": "OfficerDemo@2026"},
    )
    token = login_resp.json()["access_token"]

    # 2. Request profile with valid token
    me_resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["username"] == "officer_deshmukh"
    assert me_data["role"] == UserRole.INSTITUTION_OFFICER.value
    assert me_data["name"] == "Dr. Anand Deshmukh"

    # 3. Request profile without token -> 401
    unauth_resp = client.get("/api/v1/auth/me")
    assert unauth_resp.status_code == 401

    # 4. Request profile with junk token -> 401
    junk_resp = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not_a_real_token"})
    assert junk_resp.status_code == 401


def test_logout_endpoint_revokes_token(client):
    """Verifies POST /api/v1/auth/logout invalidates token for subsequent requests."""
    # 1. Login
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "verif_malhotra", "password": "VerifDemo@2026"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Verify token works
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200

    # 3. Logout
    logout_resp = client.post("/api/v1/auth/logout", headers=headers)
    assert logout_resp.status_code == 200
    assert "Logged out successfully" in logout_resp.json()["message"]

    # 4. Attempt to use revoked token -> 401
    revoked_resp = client.get("/api/v1/auth/me", headers=headers)
    assert revoked_resp.status_code == 401
    assert "revoked" in revoked_resp.json()["detail"].lower()


def test_demo_accounts_metadata_endpoint(client):
    """Verifies GET /api/v1/auth/demo-accounts returns safe development hints."""
    resp = client.get("/api/v1/auth/demo-accounts")
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] == "DEVELOPMENT_DEMO_ONLY"
    assert len(data["accounts"]) >= 4
    roles = {acc["role"] for acc in data["accounts"]}
    assert UserRole.AICTE_ADMIN.value in roles
    assert UserRole.INSTITUTION_OFFICER.value in roles


# -----------------------------------------------------------------------------
# 5. Role & Institution Enforcement Guard Tests
# -----------------------------------------------------------------------------

def test_require_roles_dependency(test_db):
    """Verifies that require_roles permits authorized roles and blocks others with 403."""
    _, TestingSession = test_db
    session = TestingSession()

    admin = session.query(User).filter_by(role=UserRole.AICTE_ADMIN.value).first()
    officer = session.query(User).filter_by(role=UserRole.INSTITUTION_OFFICER.value).first()

    admin_checker = require_roles(UserRole.AICTE_ADMIN.value)

    # Admin passes
    assert admin_checker(current_user=admin) == admin

    # Officer fails -> 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        admin_checker(current_user=officer)
    assert exc_info.value.status_code == 403
    assert "Access forbidden" in exc_info.value.detail
    session.close()


def test_institution_isolation_guard(test_db):
    """Verifies that Institution Officer cannot access another institution's scope."""
    _, TestingSession = test_db
    session = TestingSession()

    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    officer_b = session.query(User).filter_by(username="officer_venkatesh").first()
    admin = session.query(User).filter_by(role=UserRole.AICTE_ADMIN.value).first()

    # Officer A accessing their own institution -> Permitted
    assert enforce_institution_isolation(officer_a, officer_a.institution_id) is True

    # Officer A accessing Officer B's institution -> 403 Forbidden
    with pytest.raises(HTTPException) as exc:
        enforce_institution_isolation(officer_a, officer_b.institution_id)
    assert exc.value.status_code == 403
    assert "another institution" in exc.value.detail

    # AICTE Admin accessing any institution -> Permitted
    assert enforce_institution_isolation(admin, officer_a.institution_id) is True
    assert enforce_institution_isolation(admin, officer_b.institution_id) is True
    session.close()


def test_derive_institution_id_security(test_db):
    """Verifies derive_institution_id extracts ID from authenticated user, not client input."""
    _, TestingSession = test_db
    session = TestingSession()

    officer_a = session.query(User).filter_by(username="officer_deshmukh").first()
    admin = session.query(User).filter_by(role=UserRole.AICTE_ADMIN.value).first()

    # Derived ID matches officer's database institution_id
    assert derive_institution_id(officer_a) == officer_a.institution_id

    # Admin is not an Institution Officer -> 400 Bad Request
    with pytest.raises(HTTPException) as exc:
        derive_institution_id(admin)
    assert exc.value.status_code == 400
    session.close()
