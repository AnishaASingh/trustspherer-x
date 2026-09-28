import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

load_dotenv()

# ============================================================
# SECURITY CONFIGURATION
# ============================================================

JWT_SECRET = os.environ.get("JWT_SECRET", "trustsphere_super_secret_jwt_key_2026_soc_enterprise")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRATION_MINUTES = int(os.environ.get("JWT_EXPIRATION_MINUTES", "1440"))

security_bearer = HTTPBearer(auto_error=False)


# ============================================================
# PASSWORD HASHING (PBKDF2-HMAC-SHA256)
# ============================================================

def hash_password(password: str) -> str:
    """
    Hashes password using PBKDF2-HMAC-SHA256 with 100,000 iterations and a 16-byte salt.
    """
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        100000
    )
    return f"{salt}:{key.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    """
    Verifies a password against its stored hash.
    Supports PBKDF2 format (salt:key) and legacy SHA-256 fallback.
    """
    try:
        if ":" not in hashed:
            return hashlib.sha256(password.encode("utf-8")).hexdigest() == hashed
        salt, key_hex = hashed.split(":", 1)
        new_key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt),
            100000
        )
        return secrets.compare_digest(new_key.hex(), key_hex)
    except Exception:
        return False


# ============================================================
# JWT TOKEN MANAGEMENT
# ============================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Generates a signed JWT access token with expiration.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRATION_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decodes and validates a JWT token. Returns payload dict or None.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


# ============================================================
# AUTHENTICATION DEPENDENCIES FOR FASTAPI
# ============================================================

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)
) -> Dict[str, Any]:
    """
    Mandatory authentication dependency for protected endpoints.
    """
    from database import get_users_collection

    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing Bearer token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    email = payload.get("sub") or payload.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing subject identifier.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    users_col = get_users_collection()
    user = users_col.find_one({"email": email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token no longer exists.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Prevent deactivated users from accessing protected endpoints
    if user.get("is_active") is False or str(user.get("status", "")).upper() == "INACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deactivated. Please contact an administrator."
        )

    user["_id"] = str(user["_id"])
    if "password_hash" in user:
        del user["password_hash"]
    return user


def require_admin(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Authorization dependency that ensures the requesting user has the ADMIN role.
    """
    user_role = str(current_user.get("role", "")).strip().upper()
    if user_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required to access this resource."
        )
    return current_user



def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)
) -> Optional[Dict[str, Any]]:
    """
    Optional authentication dependency for endpoints that work both authenticated and public.
    """
    from database import get_users_collection

    if not credentials or not credentials.credentials:
        return None

    payload = decode_access_token(credentials.credentials)
    if not payload:
        return None

    email = payload.get("sub") or payload.get("email")
    if not email:
        return None

    users_col = get_users_collection()
    user = users_col.find_one({"email": email})
    if user:
        user["_id"] = str(user["_id"])
        if "password_hash" in user:
            del user["password_hash"]
        return user
    return None
