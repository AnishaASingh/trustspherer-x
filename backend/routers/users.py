from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status, Depends
from bson import ObjectId

from database import get_users_collection, get_employees_collection
from schemas.users import (
    UserAdminCreateRequest,
    UserAdminUpdateRequest,
    UserAdminStatusRequest,
    UserAdminPasswordResetRequest,
    UserAdminResponse,
    UserAdminListResponse
)
from schemas.common import ApiResponse, ApiErrorResponse
from utils.security import hash_password, require_admin
from utils.audit import record_audit_log

router = APIRouter(prefix="/api/users", tags=["User Management"])


def _format_user_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes a MongoDB user document into a safe UserAdminResponse representation.
    Guarantees password_hash is never exposed and handles legacy nulls gracefully.
    """
    is_active = doc.get("is_active")
    status_val = doc.get("status")

    if is_active is None and status_val is None:
        is_active = True
        status_val = "ACTIVE"
    elif is_active is None:
        is_active = (str(status_val).upper() == "ACTIVE")
    elif status_val is None:
        status_val = "ACTIVE" if is_active else "INACTIVE"
    else:
        status_val = str(status_val).upper()
        is_active = bool(is_active)

    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", "Unknown User"),
        "email": doc.get("email", ""),
        "role": doc.get("role", "Security Analyst"),
        "department": doc.get("department"),
        "employee_id": doc.get("employee_id"),
        "status": status_val,
        "is_active": is_active,
        "created_at": doc.get("created_at", datetime.utcnow().isoformat()),
        "updated_at": doc.get("updated_at")
    }


# ============================================================
# 1. LIST & SEARCH USERS (ADMIN ONLY)
# ============================================================
@router.get(
    "",
    response_model=ApiResponse[UserAdminListResponse],
    responses={403: {"model": ApiErrorResponse}}
)
@router.get(
    "/",
    response_model=ApiResponse[UserAdminListResponse],
    responses={403: {"model": ApiErrorResponse}}
)
def list_users(
    q: Optional[str] = Query(None, description="Search query matching name, email, or employee ID"),
    role: Optional[str] = Query(None, description="Filter by user role"),
    department: Optional[str] = Query(None, description="Filter by department"),
    status: Optional[str] = Query(None, description="Filter by status (ACTIVE / INACTIVE)"),
    limit: int = Query(100, ge=1, le=500),
    current_user: Dict[str, Any] = Depends(require_admin)
):
    users_col = get_users_collection()
    query: Dict[str, Any] = {}

    if q and q.strip():
        search_regex = {"$regex": q.strip(), "$options": "i"}
        query["$or"] = [
            {"name": search_regex},
            {"email": search_regex},
            {"employee_id": search_regex}
        ]

    if role and role.upper() != "ALL":
        query["role"] = {"$regex": f"^{role.strip()}$", "$options": "i"}

    if department and department.upper() != "ALL":
        query["department"] = {"$regex": f"^{department.strip()}$", "$options": "i"}

    if status and status.upper() != "ALL":
        st_upper = status.upper().strip()
        if st_upper == "ACTIVE":
            query["$and"] = query.get("$and", []) + [
                {
                    "$or": [
                        {"status": "ACTIVE"},
                        {"is_active": True},
                        {"status": {"$exists": False}, "is_active": {"$exists": False}}
                    ]
                }
            ]
        elif st_upper == "INACTIVE":
            query["$and"] = query.get("$and", []) + [
                {
                    "$or": [
                        {"status": "INACTIVE"},
                        {"is_active": False}
                    ]
                }
            ]

    # Always project out password_hash
    docs = list(users_col.find(query, {"password_hash": 0}).sort("created_at", -1).limit(limit))
    formatted_users = [_format_user_doc(u) for u in docs]

    return ApiResponse(
        success=True,
        data={
            "count": len(formatted_users),
            "users": formatted_users
        }
    )


# ============================================================
# 2. CREATE NEW USER (ADMIN ONLY)
# ============================================================
@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[UserAdminResponse],
    responses={400: {"model": ApiErrorResponse}, 403: {"model": ApiErrorResponse}}
)
@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[UserAdminResponse],
    responses={400: {"model": ApiErrorResponse}, 403: {"model": ApiErrorResponse}}
)
def create_user(
    req: UserAdminCreateRequest,
    current_user: Dict[str, Any] = Depends(require_admin)
):
    users_col = get_users_collection()
    clean_email = req.email.strip().lower()

    # Check for duplicate email
    existing = users_col.find_one({"email": {"$regex": f"^{clean_email}$", "$options": "i"}})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A user account with email '{clean_email}' already exists."
        )

    now_iso = datetime.utcnow().isoformat()
    status_val = (req.status or "ACTIVE").strip().upper()
    is_active = (status_val == "ACTIVE")

    # If employee_id is provided, resolve department if omitted
    resolved_dept = req.department.strip() if req.department else None
    if req.employee_id and not resolved_dept:
        emp_col = get_employees_collection()
        emp = emp_col.find_one({"employee_id": req.employee_id.strip()})
        if emp and emp.get("department_id"):
            resolved_dept = emp.get("department_id")

    user_doc = {
        "name": req.name.strip(),
        "email": clean_email,
        "password_hash": hash_password(req.password),
        "role": req.role.strip() if req.role else "Security Analyst",
        "department": resolved_dept,
        "employee_id": req.employee_id.strip() if req.employee_id else None,
        "status": status_val,
        "is_active": is_active,
        "created_at": now_iso,
        "updated_at": now_iso
    }

    result = users_col.insert_one(user_doc)
    new_user_id = str(result.inserted_id)
    user_doc["_id"] = result.inserted_id

    # Record administrative audit trail
    record_audit_log(
        action="USER_CREATE",
        entity_type="USER",
        entity_id=new_user_id,
        user_id=str(current_user.get("_id", "ADMIN")),
        description=f"Admin {current_user.get('email')} created user '{req.name.strip()}' ({clean_email}) with role '{user_doc['role']}'."
    )

    formatted = _format_user_doc(user_doc)
    return ApiResponse(
        success=True,
        data=formatted,
        message=f"User account '{clean_email}' created successfully."
    )


# ============================================================
# 3. GET SINGLE USER DETAILS (ADMIN ONLY)
# ============================================================
@router.get(
    "/{user_id}",
    response_model=ApiResponse[UserAdminResponse],
    responses={404: {"model": ApiErrorResponse}, 403: {"model": ApiErrorResponse}}
)
def get_user_detail(
    user_id: str,
    current_user: Dict[str, Any] = Depends(require_admin)
):
    users_col = get_users_collection()
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format.")

    user = users_col.find_one({"_id": obj_id}, {"password_hash": 0})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID '{user_id}' not found.")

    return ApiResponse(
        success=True,
        data=_format_user_doc(user)
    )


# ============================================================
# 4. UPDATE USER DETAILS & ROLE (ADMIN ONLY)
# ============================================================
@router.patch(
    "/{user_id}",
    response_model=ApiResponse[UserAdminResponse],
    responses={400: {"model": ApiErrorResponse}, 404: {"model": ApiErrorResponse}, 403: {"model": ApiErrorResponse}}
)
def update_user(
    user_id: str,
    req: UserAdminUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_admin)
):
    users_col = get_users_collection()
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format.")

    target = users_col.find_one({"_id": obj_id})
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID '{user_id}' not found.")

    is_self = (str(current_user.get("_id")) == str(target["_id"]))

    # Prevent current admin from demoting themselves
    if is_self and req.role and req.role.strip().upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Safety lock: You cannot remove your own administrator role."
        )

    # Prevent current admin from deactivating themselves
    if is_self and req.status and req.status.strip().upper() == "INACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Safety lock: You cannot deactivate your own administrator account."
        )

    now_iso = datetime.utcnow().isoformat()
    updates: Dict[str, Any] = {"updated_at": now_iso}

    if req.name is not None and req.name.strip():
        updates["name"] = req.name.strip()
    if req.role is not None and req.role.strip():
        updates["role"] = req.role.strip()
    if req.department is not None:
        updates["department"] = req.department.strip() or None
    if req.employee_id is not None:
        updates["employee_id"] = req.employee_id.strip() or None
    if req.status is not None:
        st_val = req.status.strip().upper()
        updates["status"] = st_val
        updates["is_active"] = (st_val == "ACTIVE")

    users_col.update_one({"_id": obj_id}, {"$set": updates})

    # Record administrative audit trail
    record_audit_log(
        action="USER_UPDATE",
        entity_type="USER",
        entity_id=str(user_id),
        user_id=str(current_user.get("_id", "ADMIN")),
        description=f"Admin {current_user.get('email')} updated details for user '{target.get('email')}'. Modified fields: {list(updates.keys())}."
    )

    updated_doc = users_col.find_one({"_id": obj_id}, {"password_hash": 0})
    return ApiResponse(
        success=True,
        data=_format_user_doc(updated_doc),
        message=f"User '{target.get('email')}' updated successfully."
    )


# ============================================================
# 5. ACTIVATE / DEACTIVATE USER STATUS (ADMIN ONLY)
# ============================================================
@router.patch(
    "/{user_id}/status",
    response_model=ApiResponse[UserAdminResponse],
    responses={400: {"model": ApiErrorResponse}, 404: {"model": ApiErrorResponse}, 403: {"model": ApiErrorResponse}}
)
def update_user_status(
    user_id: str,
    req: UserAdminStatusRequest,
    current_user: Dict[str, Any] = Depends(require_admin)
):
    users_col = get_users_collection()
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format.")

    target = users_col.find_one({"_id": obj_id})
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID '{user_id}' not found.")

    is_self = (str(current_user.get("_id")) == str(target["_id"]))
    new_status = req.status.strip().upper()

    # Self-deactivation lock
    if is_self and new_status == "INACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Safety lock: You cannot deactivate your own administrator account."
        )

    now_iso = datetime.utcnow().isoformat()
    is_active = (new_status == "ACTIVE")

    users_col.update_one(
        {"_id": obj_id},
        {"$set": {"status": new_status, "is_active": is_active, "updated_at": now_iso}}
    )

    # Record administrative audit trail
    record_audit_log(
        action="USER_STATUS_CHANGE",
        entity_type="USER",
        entity_id=str(user_id),
        user_id=str(current_user.get("_id", "ADMIN")),
        description=f"Admin {current_user.get('email')} changed status of user '{target.get('email')}' to '{new_status}'."
    )

    updated_doc = users_col.find_one({"_id": obj_id}, {"password_hash": 0})
    return ApiResponse(
        success=True,
        data=_format_user_doc(updated_doc),
        message=f"User '{target.get('email')}' is now {new_status}."
    )


# ============================================================
# 6. RESET USER PASSWORD (ADMIN ONLY)
# ============================================================
@router.post(
    "/{user_id}/reset-password",
    response_model=ApiResponse[Dict[str, Any]],
    responses={400: {"model": ApiErrorResponse}, 404: {"model": ApiErrorResponse}, 403: {"model": ApiErrorResponse}}
)
def reset_user_password(
    user_id: str,
    req: UserAdminPasswordResetRequest,
    current_user: Dict[str, Any] = Depends(require_admin)
):
    users_col = get_users_collection()
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format.")

    target = users_col.find_one({"_id": obj_id})
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID '{user_id}' not found.")

    if len(req.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long."
        )

    new_hash = hash_password(req.new_password)
    now_iso = datetime.utcnow().isoformat()

    users_col.update_one(
        {"_id": obj_id},
        {"$set": {"password_hash": new_hash, "updated_at": now_iso}}
    )

    # Record administrative audit trail
    record_audit_log(
        action="PASSWORD_RESET",
        entity_type="USER",
        entity_id=str(user_id),
        user_id=str(current_user.get("_id", "ADMIN")),
        description=f"Admin {current_user.get('email')} reset password for user '{target.get('email')}'."
    )

    return ApiResponse(
        success=True,
        data={"user_id": str(user_id), "email": target.get("email")},
        message=f"Password for user '{target.get('email')}' has been reset successfully."
    )


# ============================================================
# 7. DELETE USER ACCOUNT (ADMIN ONLY)
# ============================================================
@router.delete(
    "/{user_id}",
    response_model=ApiResponse[Dict[str, Any]],
    responses={400: {"model": ApiErrorResponse}, 404: {"model": ApiErrorResponse}, 403: {"model": ApiErrorResponse}}
)
def delete_user(
    user_id: str,
    current_user: Dict[str, Any] = Depends(require_admin)
):
    users_col = get_users_collection()
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format.")

    target = users_col.find_one({"_id": obj_id})
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User with ID '{user_id}' not found.")

    is_self = (str(current_user.get("_id")) == str(target["_id"]))

    # Prevent administrator from deleting themselves
    if is_self:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Safety lock: You cannot delete your own administrator account."
        )

    deleted_email = target.get("email")
    deleted_name = target.get("name")
    users_col.delete_one({"_id": obj_id})

    # Record administrative audit trail
    record_audit_log(
        action="USER_DELETE",
        entity_type="USER",
        entity_id=str(user_id),
        user_id=str(current_user.get("_id", "ADMIN")),
        description=f"Admin {current_user.get('email')} permanently deleted user account '{deleted_name}' ({deleted_email})."
    )

    return ApiResponse(
        success=True,
        data={"user_id": str(user_id), "email": deleted_email},
        message=f"User account '{deleted_email}' has been permanently deleted."
    )
