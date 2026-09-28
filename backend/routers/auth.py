from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime
from database import get_users_collection
from schemas.auth import UserRegisterRequest, UserLoginRequest, UserResponse, TokenResponse
from schemas.common import ApiResponse, ApiErrorResponse
from utils.security import hash_password, verify_password, create_access_token, get_current_user
from utils.audit import record_audit_log

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[UserResponse],
    responses={400: {"model": ApiErrorResponse}}
)
def register_user(req: UserRegisterRequest):
    users_col = get_users_collection()
    clean_email = req.email.strip().lower()

    existing = users_col.find_one({"email": clean_email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    now_iso = datetime.utcnow().isoformat()
    user_doc = {
        "name": req.name.strip(),
        "email": clean_email,
        "password_hash": hash_password(req.password),
        "role": req.role or "Security Administrator",
        "created_at": now_iso,
        "updated_at": now_iso
    }

    result = users_col.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Record audit log
    record_audit_log(
        action="REGISTER",
        entity_type="USER",
        entity_id=user_id,
        user_id=user_id,
        description=f"User {req.name} registered with email {clean_email}."
    )

    user_response = UserResponse(
        id=user_id,
        name=user_doc["name"],
        email=user_doc["email"],
        role=user_doc["role"],
        created_at=user_doc["created_at"],
        updated_at=user_doc["updated_at"]
    )

    return ApiResponse(
        success=True,
        data=user_response,
        message="User account registered successfully."
    )


@router.post(
    "/login",
    response_model=ApiResponse[TokenResponse],
    responses={401: {"model": ApiErrorResponse}}
)
def login_user(req: UserLoginRequest):
    users_col = get_users_collection()
    clean_email = req.email.strip().lower()

    user = users_col.find_one({"email": clean_email})

    # Check registered user password
    if user and verify_password(req.password, user.get("password_hash", "")):
        if user.get("is_active") is False or str(user.get("status", "")).upper() == "INACTIVE":
            user_id = str(user["_id"])
            record_audit_log(
                action="LOGIN_BLOCKED",
                entity_type="USER",
                entity_id=user_id,
                user_id=user_id,
                description=f"Deactivated user {clean_email} attempted login.",
                result="DENIED"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is deactivated. Please contact an administrator."
            )

        user_id = str(user["_id"])
        token = create_access_token({"sub": clean_email, "uid": user_id, "role": user.get("role")})

        record_audit_log(
            action="LOGIN",
            entity_type="USER",
            entity_id=user_id,
            user_id=user_id,
            description=f"User {user['name']} logged in successfully."
        )

        user_resp = UserResponse(
            id=user_id,
            name=user["name"],
            email=user["email"],
            role=user.get("role", "ADMIN"),
            created_at=user.get("created_at", datetime.utcnow().isoformat()),
            updated_at=user.get("updated_at")
        )

        return ApiResponse(
            success=True,
            data=TokenResponse(access_token=token, token_type="Bearer", user=user_resp),
            message="Login successful."
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password."
    )


@router.get("/me", response_model=ApiResponse[UserResponse])
def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    user_resp = UserResponse(
        id=current_user["_id"],
        name=current_user["name"],
        email=current_user["email"],
        role=current_user.get("role", "ADMIN"),
        created_at=current_user.get("created_at", datetime.utcnow().isoformat()),
        updated_at=current_user.get("updated_at")
    )
    return ApiResponse(
        success=True,
        data=user_resp
    )


@router.get("/users", response_model=ApiResponse[list])
def list_users(current_user: dict = Depends(get_current_user)):
    users_col = get_users_collection()
    users = list(users_col.find({}, {"password_hash": 0}).limit(100))
    formatted = []
    for u in users:
        formatted.append({
            "id": str(u["_id"]),
            "name": u.get("name"),
            "email": u.get("email"),
            "role": u.get("role"),
            "created_at": u.get("created_at")
        })
    return ApiResponse(success=True, data=formatted)
