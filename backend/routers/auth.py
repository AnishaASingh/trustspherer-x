from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime
from typing import Optional, Dict, Any
from database import get_users_collection, get_employees_collection
from schemas.auth import (
    UserRegisterRequest,
    OrganizationSetupRequest,
    UserLoginRequest,
    UserResponse,
    TokenResponse
)
from schemas.common import ApiResponse, ApiErrorResponse
from utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_admin,
    require_admin_when_authenticated,
    is_admin_user,
    normalize_user_role
)
from utils.audit import record_audit_log

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def _get_configured_admin(users_col) -> Optional[Dict[str, Any]]:
    """
    Finds the primary ADMIN user document in `users` if the organization has been initialized.
    """
    return users_col.find_one({
        "role": {"$in": ["ADMIN", "Security Administrator", "SUPER_ADMIN", "admin"]}
    })


def _resolve_org_info(users_col, user_doc: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
    """
    Resolves organization_name and organization_id from the user record or the initial ADMIN record.
    """
    if user_doc and user_doc.get("organization_name") and user_doc.get("organization_id"):
        return {
            "organization_name": str(user_doc["organization_name"]),
            "organization_id": str(user_doc["organization_id"])
        }
    admin_doc = _get_configured_admin(users_col)
    if admin_doc:
        return {
            "organization_name": str(admin_doc.get("organization_name") or "TrustSphere Enterprise"),
            "organization_id": str(admin_doc.get("organization_id") or "ORG-TS-01")
        }
    return {
        "organization_name": "TrustSphere Enterprise",
        "organization_id": "ORG-TS-01"
    }


@router.get("/setup-status", response_model=ApiResponse[Dict[str, Any]])
def get_organization_setup_status():
    """
    Checks whether one-time Organization Setup has already been completed for this TrustSphere deployment.
    """
    users_col = get_users_collection()
    admin_doc = _get_configured_admin(users_col)
    is_configured = admin_doc is not None
    org_info = _resolve_org_info(users_col, admin_doc) if is_configured else {
        "organization_name": None,
        "organization_id": None
    }
    return ApiResponse(
        success=True,
        data={
            "is_configured": is_configured,
            "organization_name": org_info["organization_name"],
            "organization_id": org_info["organization_id"]
        }
    )


@router.post(
    "/setup",
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[UserResponse],
    responses={400: {"model": ApiErrorResponse}, 403: {"model": ApiErrorResponse}}
)
def complete_organization_setup(req: OrganizationSetupRequest):
    """
    Completes one-time Organization Setup:
    - Rejects execution if an ADMIN / organization is already configured in MongoDB.
    - Creates the initial ADMIN user with organization_name and organization_id stored on the user record.
    - Hashes password with PBKDF2-HMAC-SHA256.
    """
    users_col = get_users_collection()
    existing_admin = _get_configured_admin(users_col)
    if existing_admin is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="TrustSphere is already configured for this organization."
        )

    clean_email = req.admin_email.strip().lower()
    clean_org_id = req.organization_id.strip().upper()
    clean_org_name = req.organization_name.strip()
    clean_admin_name = req.admin_name.strip()

    if users_col.find_one({"email": {"$regex": f"^{clean_email}$", "$options": "i"}}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this administrator email address already exists."
        )

    if users_col.find_one({"organization_id": {"$regex": f"^{clean_org_id}$", "$options": "i"}}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Organization ID '{clean_org_id}' is already registered."
        )

    now_iso = datetime.utcnow().isoformat()
    user_doc = {
        "name": clean_admin_name,
        "email": clean_email,
        "password_hash": hash_password(req.password),
        "role": "ADMIN",
        "organization_name": clean_org_name,
        "organization_id": clean_org_id,
        "department": "Security",
        "status": "ACTIVE",
        "is_active": True,
        "created_at": now_iso,
        "updated_at": now_iso
    }

    result = users_col.insert_one(user_doc)
    user_id = str(result.inserted_id)

    record_audit_log(
        action="ORGANIZATION_SETUP",
        entity_type="AUTH",
        entity_id=clean_org_id,
        user_id=clean_email,
        description=f"Initial organization setup completed for '{clean_org_name}' ({clean_org_id}) by ADMIN {clean_admin_name} ({clean_email})."
    )

    user_response = UserResponse(
        id=user_id,
        name=user_doc["name"],
        email=user_doc["email"],
        role="ADMIN",
        organization_name=clean_org_name,
        organization_id=clean_org_id,
        department="Security",
        status="ACTIVE",
        created_at=now_iso,
        updated_at=now_iso
    )

    return ApiResponse(
        success=True,
        data=user_response,
        message=f"Organization '{clean_org_name}' setup completed successfully."
    )


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

    # Block public self-registration once organization setup has been completed
    if _admin is None and _get_configured_admin(users_col) is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="TrustSphere is already configured for this organization. New accounts must be provisioned by an Administrator."
        )

    clean_email = req.email.strip().lower()

    existing = users_col.find_one({"email": clean_email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    org_info = _resolve_org_info(users_col, _admin)
    org_name = (req.organization_name or org_info["organization_name"]).strip()
    org_id = (req.organization_id or org_info["organization_id"]).strip().upper()
    canonical_role = normalize_user_role(req.role or "ADMIN")

    now_iso = datetime.utcnow().isoformat()
    user_doc = {
        "name": req.name.strip(),
        "email": clean_email,
        "password_hash": hash_password(req.password),
        "role": canonical_role,
        "organization_name": org_name,
        "organization_id": org_id,
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
        user_id=_admin.get("email", user_id) if _admin else user_id,
        description=f"User {req.name} ({canonical_role}) provisioned with email {clean_email}."
    )

    user_response = UserResponse(
        id=user_id,
        name=user_doc["name"],
        email=user_doc["email"],
        role=user_doc["role"],
        organization_name=org_name,
        organization_id=org_id,
        status="ACTIVE",
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
            "role": normalize_user_role(emp_doc.get("access_role", "EMPLOYEE")),
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
        raw_role = user.get("role") or (emp_doc.get("access_role") if emp_doc else "EMPLOYEE")
        normalized_role = normalize_user_role(raw_role)
        org_info = _resolve_org_info(users_col, user)
        token = create_access_token({"sub": user["email"], "uid": user_id, "role": normalized_role})

        record_audit_log(
            action="LOGIN",
            entity_type="USER",
            entity_id=user_id,
            user_id=user["email"],
            description=f"User {user['name']} ({normalized_role}) logged in successfully."
        )

        user_resp = UserResponse(
            id=user_id,
            name=user["name"],
            email=user["email"],
            role=normalized_role,
            organization_name=org_info["organization_name"],
            organization_id=org_info["organization_id"],
            department=user.get("department") or (emp_doc.get("department_id") if emp_doc else None),
            employee_id=user.get("employee_id") or (emp_doc.get("employee_id") if emp_doc else None),
            status=str(user.get("status", "ACTIVE")).upper(),
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
    users_col = get_users_collection()
    org_info = _resolve_org_info(users_col, current_user)
    normalized_role = normalize_user_role(current_user.get("role", "EMPLOYEE"))
    user_resp = UserResponse(
        id=current_user["_id"],
        name=current_user["name"],
        email=current_user["email"],
        role=normalized_role,
        organization_name=org_info["organization_name"],
        organization_id=org_info["organization_id"],
        department=current_user.get("department"),
        employee_id=current_user.get("employee_id"),
        status=str(current_user.get("status", "ACTIVE")).upper(),
        created_at=current_user.get("created_at", datetime.utcnow().isoformat()),
        updated_at=current_user.get("updated_at")
    )
    return ApiResponse(
        success=True,
        data=user_resp
    )


@router.get("/users", response_model=ApiResponse[list])
def list_users(current_user: dict = Depends(require_admin)):
    users_col = get_users_collection()
    users = list(users_col.find({}, {"password_hash": 0}).limit(100))
    formatted = []
    for u in users:
        formatted.append({
            "id": str(u["_id"]),
            "name": u.get("name"),
            "email": u.get("email"),
            "role": normalize_user_role(u.get("role")),
            "department": u.get("department"),
            "employee_id": u.get("employee_id"),
            "status": u.get("status", "ACTIVE"),
            "created_at": u.get("created_at")
        })
    return ApiResponse(success=True, data=formatted)

