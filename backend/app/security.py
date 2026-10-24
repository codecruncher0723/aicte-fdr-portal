"""
Security, Cryptographic Hashing, and Token Management Utilities.
- Password hashing: PBKDF2-HMAC-SHA256 with 100,000 iterations & random 16-byte salt.
- JWT tokens: Pure Python RFC 7519 compliant HS256 signed bearer tokens.
- Token revocation: Thread-safe in-memory token revocation cache for logouts.
"""

import base64
import hashlib
import hmac
import json
import os
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, Set
from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES


class SecurityError(Exception):
    """Base exception for security and authentication failures."""
    pass


class TokenExpiredError(SecurityError):
    """Raised when an authentication token has expired."""
    pass


class InvalidTokenError(SecurityError):
    """Raised when an authentication token is malformed or signature is invalid."""
    pass


class TokenRevokedError(SecurityError):
    """Raised when an authentication token has been revoked via logout."""
    pass


# -----------------------------------------------------------------------------
# Password Hashing & Verification (PBKDF2-HMAC-SHA256)
# -----------------------------------------------------------------------------

def hash_password(password: str, salt: bytes = None) -> str:
    """
    Hashes a password using PBKDF2-HMAC-SHA256 with 100,000 iterations and a 16-byte salt.
    Format: pbkdf2:sha256:100000$<salt_hex>$<key_hex>
    Never stores plaintext passwords.
    """
    if not password:
        raise ValueError("Password cannot be empty.")
    if salt is None:
        salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return f"pbkdf2:sha256:100000${salt.hex()}${key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain-text password against a stored PBKDF2 hash using constant-time comparison.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        parts = hashed_password.split("$")
        if len(parts) != 3:
            return False
        header, salt_hex, key_hex = parts
        algorithm, subalgo, iterations = header.split(":")
        if algorithm != "pbkdf2" or subalgo != "sha256":
            return False
        salt = bytes.fromhex(salt_hex)
        expected_key = bytes.fromhex(key_hex)
        actual_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, int(iterations))
        return hmac.compare_digest(actual_key, expected_key)
    except Exception:
        return False


# -----------------------------------------------------------------------------
# Pure-Python RFC 7519 HS256 JWT Implementation
# -----------------------------------------------------------------------------

def _base64url_encode(data: bytes) -> str:
    """Encodes bytes to URL-safe base64 string without trailing '=' padding."""
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _base64url_decode(data: str) -> bytes:
    """Decodes URL-safe base64 string, restoring '=' padding as needed."""
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
    secret_key: Optional[str] = None,
) -> str:
    """
    Generates an RFC 7519 compliant HS256 JWT access token.
    Standard claims:
    - sub: Subject identifier
    - iat: Issued-at timestamp
    - exp: Expiration timestamp
    - jti: Unique token UUID
    """
    secret = (secret_key or SECRET_KEY).encode("utf-8")
    now = int(time.time())
    
    if expires_delta:
        expire_seconds = int(expires_delta.total_seconds())
    else:
        expire_seconds = ACCESS_TOKEN_EXPIRE_MINUTES * 60

    payload = data.copy()
    payload.setdefault("iat", now)
    payload.setdefault("exp", now + expire_seconds)
    payload.setdefault("jti", uuid.uuid4().hex)

    header = {"alg": ALGORITHM, "typ": "JWT"}
    header_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    encoded_header = _base64url_encode(header_bytes)
    encoded_payload = _base64url_encode(payload_bytes)

    signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
    signature = hmac.new(secret, signing_input, hashlib.sha256).digest()
    encoded_signature = _base64url_encode(signature)

    return f"{encoded_header}.{encoded_payload}.{encoded_signature}"


# In-memory revocation cache for logged-out tokens: maps jti -> expiry timestamp
_REVOKED_TOKENS: Dict[str, int] = {}


def revoke_token(token: str, secret_key: Optional[str] = None) -> None:
    """Revokes a valid token so it cannot be used again."""
    payload = decode_access_token(token, secret_key=secret_key, check_revocation=False)
    jti = payload.get("jti")
    exp = payload.get("exp", int(time.time()) + 3600)
    if jti:
        _REVOKED_TOKENS[jti] = exp


def is_token_revoked(jti: str) -> bool:
    """Checks whether a token's jti is in the revocation cache and cleans expired entries."""
    now = int(time.time())
    # Cleanup expired entries periodically
    expired = [k for k, exp in _REVOKED_TOKENS.items() if exp < now]
    for k in expired:
        _REVOKED_TOKENS.pop(k, None)

    return jti in _REVOKED_TOKENS


def decode_access_token(
    token: str,
    secret_key: Optional[str] = None,
    check_revocation: bool = True,
) -> Dict[str, Any]:
    """
    Decodes and cryptographically verifies an HS256 JWT access token.
    Validates structure, signature, expiration, and revocation status.
    """
    if not token or not isinstance(token, str):
        raise InvalidTokenError("Token is missing or invalid.")

    parts = token.split(".")
    if len(parts) != 3:
        raise InvalidTokenError("Malformed JWT: expected 3 dot-separated parts.")

    encoded_header, encoded_payload, encoded_signature = parts
    secret = (secret_key or SECRET_KEY).encode("utf-8")

    # 1. Verify Signature
    signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
    expected_signature = hmac.new(secret, signing_input, hashlib.sha256).digest()
    actual_signature = _base64url_decode(encoded_signature)

    if not hmac.compare_digest(actual_signature, expected_signature):
        raise InvalidTokenError("Invalid token signature.")

    # 2. Decode Header
    try:
        header = json.loads(_base64url_decode(encoded_header).decode("utf-8"))
        if header.get("alg") != ALGORITHM:
            raise InvalidTokenError(f"Unsupported algorithm '{header.get('alg')}'.")
    except Exception as e:
        if isinstance(e, InvalidTokenError):
            raise
        raise InvalidTokenError(f"Failed to decode JWT header: {e}")

    # 3. Decode Payload
    try:
        payload = json.loads(_base64url_decode(encoded_payload).decode("utf-8"))
    except Exception as e:
        raise InvalidTokenError(f"Failed to decode JWT payload: {e}")

    # 4. Check Expiration
    exp = payload.get("exp")
    if exp is not None:
        now = int(time.time())
        if now >= exp:
            raise TokenExpiredError("Token has expired.")

    # 5. Check Revocation
    jti = payload.get("jti")
    if check_revocation and jti and is_token_revoked(jti):
        raise TokenRevokedError("Token has been revoked.")

    return payload
