from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime
from typing import Optional, Dict, Any
from database import get_users_collection, get_employees_collection
from schemas.auth import UserRegisterRequest, UserLoginRequest, UserResponse, TokenResponse
from schemas.common import ApiResponse, ApiErrorResponse
from utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_admin_when_authenticated,
    is_admin_user
)
from utils.audit import record_audit_log

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[UserResponse],
    responses={400: {"model": ApiErrorResponse}, 403: {"model": ApiErrorResponse}}
)
def register_user(
    req: UserRegisterRequest,
    _admin: Optional[Dict[str, Any]] = Depends(require_admin_when_authenticated)
):
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
        "role": req.role or "EMPLOYEE",
        "status": "ACTIVE",
        "is_active": True,
        "created_at": now_iso,
        "updated_at": now_iso
    }

    result = users_col.insert_one(user_doc)
    user_id = str(result.inserted_id)

    record_audit_log(
        action="REGISTER",
        entity_type="USER",
        entity_id=user_id,
        user_id=user_id,
        description=f"User {req.name} provisioned with email {clean_email}."
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
        message="User account provisioned successfully."
    )


@router.post(
    "/login",
    response_model=ApiResponse[TokenResponse],
    responses={401: {"model": ApiErrorResponse}}
)
def login_user(req: UserLoginRequest):
    users_col = get_users_collection()
    emp_col = get_employees_collection()
    clean_email = req.email.strip().lower()

    emp_doc = emp_col.find_one({"email": {"$regex": f"^{clean_email}$", "$options": "i"}})
    user = users_col.find_one({"email": {"$regex": f"^{clean_email}$", "$options": "i"}})

    # If the email belongs to an employee in `employees` who has no `users` record yet, auto-provision
    if emp_doc and not user:
        emp_status = str(emp_doc.get("status", "ACTIVE")).upper()
        emp_name = emp_doc.get("name") or f"{emp_doc.get('first_name', '')} {emp_doc.get('last_name', '')}".strip() or clean_email
        now_iso = datetime.utcnow().isoformat()
        new_user = {
            "name": emp_name,
            "email": clean_email,
            "password_hash": hash_password("Employee@123"),
            "role": emp_doc.get("access_role", "EMPLOYEE"),
            "department": emp_doc.get("department_id"),
            "employee_id": emp_doc.get("employee_id"),
            "status": emp_status,
            "is_active": emp_status == "ACTIVE",
            "created_at": now_iso,
            "updated_at": now_iso
        }
        ins = users_col.insert_one(new_user)
        new_user["_id"] = ins.inserted_id
        user = new_user

    # Check registered user password
    if user and verify_password(req.password, user.get("password_hash", "")):
        emp_inactive = emp_doc and str(emp_doc.get("status", "ACTIVE")).upper() == "INACTIVE"
        if user.get("is_active") is False or str(user.get("status", "")).upper() == "INACTIVE" or emp_inactive:
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
                detail="Account is deactivated. Please contact your Organization Administrator."
            )

        user_id = str(user["_id"])
        raw_role = user.get("role", "EMPLOYEE")
        normalized_role = "ADMIN" if is_admin_user(user) else "EMPLOYEE"
        token = create_access_token({"sub": user["email"], "uid": user_id, "role": normalized_role})

        record_audit_log(
            action="LOGIN",
            entity_type="USER",
            entity_id=user_id,
            user_id=user_id,
            description=f"User {user['name']} ({normalized_role}) logged in successfully."
        )

        user_resp = UserResponse(
            id=user_id,
            name=user["name"],
            email=user["email"],
            role=normalized_role if normalized_role == "ADMIN" else raw_role,
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
