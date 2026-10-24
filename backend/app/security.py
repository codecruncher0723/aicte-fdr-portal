import hashlib
import hmac
import os

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
