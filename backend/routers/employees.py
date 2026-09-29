import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status, Depends

from database import (
    get_employees_collection,
    get_users_collection,
    get_assets_collection,
    get_incidents_collection
)
from schemas.employees import EmployeeCreateRequest, EmployeeUpdateRequest, EmployeeResponse
from schemas.common import ApiResponse, ApiErrorResponse
from utils.security import hash_password, require_admin_when_authenticated
from utils.audit import record_audit_log

router = APIRouter(prefix="/api/employees", tags=["Employees"])


@router.get("", response_model=ApiResponse[Dict[str, Any]])
@router.get("/", response_model=ApiResponse[Dict[str, Any]])
def list_employees(
    department: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    _admin: Optional[Dict[str, Any]] = Depends(require_admin_when_authenticated)
):
    query: Dict[str, Any] = {}
    if department and department.upper() != "ALL":
        query["department_id"] = {"$regex": f"^{department}$", "$options": "i"}
    if status and status.upper() != "ALL":
        query["status"] = {"$regex": f"^{status}$", "$options": "i"}

    emp_col = get_employees_collection()
    employees = list(emp_col.find(query).limit(limit))
    for e in employees:
        e["_id"] = str(e["_id"])
        if "name" not in e:
            e["name"] = f"{e.get('first_name', '')} {e.get('last_name', '')}".strip()
        if "access_role" not in e:
            e["access_role"] = "EMPLOYEE"

    return ApiResponse(
        success=True,
        data={"count": len(employees), "employees": employees}
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ApiResponse[Dict[str, Any]])
@router.post("/", status_code=status.HTTP_201_CREATED, response_model=ApiResponse[Dict[str, Any]])
def create_employee(
    req: EmployeeCreateRequest,
    _admin: Optional[Dict[str, Any]] = Depends(require_admin_when_authenticated)
):
    emp_col = get_employees_collection()
    users_col = get_users_collection()
    clean_email = req.email.strip().lower()

    existing = emp_col.find_one({"email": clean_email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An employee with email '{clean_email}' already exists."
        )

    employee_id = f"EMP-{uuid.uuid4().hex[:6].upper()}"
    now_iso = datetime.utcnow().isoformat()
    full_name = f"{req.first_name.strip()} {req.last_name.strip()}".strip()
    emp_status = (req.status or "ACTIVE").strip().upper()
    access_role = (req.access_role or "EMPLOYEE").strip().upper()

    doc = {
        "employee_id": employee_id,
        "first_name": req.first_name.strip(),
        "last_name": req.last_name.strip(),
        "name": full_name,
        "email": clean_email,
        "department_id": req.department_id,
        "role": req.role.strip(),
        "access_role": access_role,
        "status": emp_status,
        "trust_score": req.trust_score,
        "created_at": now_iso,
        "updated_at": now_iso
    }

    result = emp_col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    # Also provision or synchronize login credentials in `users` collection
    raw_password = req.password.strip() if req.password and req.password.strip() else "Employee@123"
    user_payload = {
        "name": full_name,
        "email": clean_email,
        "password_hash": hash_password(raw_password),
        "role": access_role,
        "job_title": req.role.strip(),
        "department": req.department_id,
        "employee_id": employee_id,
        "status": emp_status,
        "is_active": emp_status == "ACTIVE",
        "updated_at": now_iso
    }
    existing_user = users_col.find_one({"email": clean_email})
    if existing_user:
        users_col.update_one({"_id": existing_user["_id"]}, {"$set": user_payload})
    else:
        user_payload["created_at"] = now_iso
        users_col.insert_one(user_payload)

    record_audit_log(
        action="EMPLOYEE_CREATED",
        entity_type="EMPLOYEE",
        entity_id=employee_id,
        user_id="ADMIN",
        description=f"Employee profile & console login created: {full_name} ({clean_email}) in {req.department_id} as {req.role} ({access_role})."
    )

    return ApiResponse(
        success=True,
        data=doc,
        message=f"Employee {full_name} added successfully."
    )


@router.get("/{employee_id}", response_model=ApiResponse[Dict[str, Any]])
def get_employee_details(
    employee_id: str,
    _admin: Optional[Dict[str, Any]] = Depends(require_admin_when_authenticated)
):
    emp_col = get_employees_collection()
    emp = emp_col.find_one({
        "$or": [
            {"employee_id": employee_id},
            {"employee_id": employee_id.upper()}
        ]
    })
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee '{employee_id}' not found."
        )

    emp["_id"] = str(emp["_id"])
    if "name" not in emp:
        emp["name"] = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
    if "access_role" not in emp:
        emp["access_role"] = "EMPLOYEE"

    assets_col = get_assets_collection()
    inc_col = get_incidents_collection()
    from database import get_audit_logs_collection
    audit_col = get_audit_logs_collection()

    dept_name = emp.get("department_id", "")
    associated_assets = list(
        assets_col.find({
            "department_id": dept_name,
            "is_demo": {"$ne": True},
            "email_metadata.is_demo": {"$ne": True},
            "email_metadata.simulated": {"$ne": True},
            "ingestion_mode": {"$ne": "DEMO"}
        }).limit(10)
    )
    for a in associated_assets:
        a["_id"] = str(a["_id"])

    associated_incidents = list(
        inc_col.find({
            "department_id": dept_name,
            "is_demo": {"$ne": True}
        }).limit(10)
    )
    for i in associated_incidents:
        i["_id"] = str(i["_id"])

    emp_id_val = emp.get("employee_id", "")
    emp_email_val = emp.get("email", "")
    emp_name_val = emp.get("name", "")
    raw_logs = list(
        audit_col.find({
            "$or": [
                {"entity_id": emp_id_val},
                {"user_id": emp_email_val},
                {"user_id": emp_name_val}
            ]
        }).sort("timestamp", -1).limit(10)
    )
    emp["activities"] = [
        {
            "action": f"{log.get('action', 'ACTIVITY')}: {log.get('description', '')}".strip(": "),
            "time": str(log.get("timestamp", "")).replace("T", " ")[:16],
            "risk": "HIGH" if log.get("result") in ("CRITICAL", "WARNING") else "LOW"
        }
        for log in raw_logs
    ]

    emp["associated_assets"] = associated_assets
    emp["related_incidents"] = associated_incidents
    role_upper = str(emp.get("access_role", "EMPLOYEE")).upper()
    if role_upper == "ADMIN":
        emp["permissions"] = ["Full Platform Governance", "All Modules", "User & Employee Provisioning", "Email & OAuth Integration"]
    elif role_upper == "MANAGER":
        emp["permissions"] = ["Department Overview", "Digital Assets & Verification", "Trust Analysis", "Incidents & AI Triage"]
    elif role_upper == "AUDITOR":
        emp["permissions"] = ["Audit Logs (Read-Only)", "Reports & Compliance", "Digital Assets", "Trust Analysis", "Incidents"]
    else:
        emp["permissions"] = ["Dashboard", "Digital Assets", "Trust Analysis", "Incidents", "Settings"]

    return ApiResponse(success=True, data={"employee": emp})


@router.patch("/{employee_id}", response_model=ApiResponse[Dict[str, Any]])
@router.put("/{employee_id}", response_model=ApiResponse[Dict[str, Any]])
def update_employee(
    employee_id: str,
    req: EmployeeUpdateRequest,
    _admin: Optional[Dict[str, Any]] = Depends(require_admin_when_authenticated)
):
    emp_col = get_employees_collection()
    users_col = get_users_collection()
    emp = emp_col.find_one({
        "$or": [
            {"employee_id": employee_id},
            {"employee_id": employee_id.upper()}
        ]
    })
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee '{employee_id}' not found."
        )

    canonical_id = emp["employee_id"]
    old_email = emp.get("email", "").strip().lower()
    update_data: Dict[str, Any] = {}

    if req.name is not None and req.name.strip():
        clean_name = req.name.strip()
        parts = clean_name.split(" ")
        update_data["first_name"] = parts[0]
        update_data["last_name"] = " ".join(parts[1:]) if len(parts) > 1 else ""
        update_data["name"] = clean_name

    if req.first_name is not None:
        update_data["first_name"] = req.first_name.strip()
    if req.last_name is not None:
        update_data["last_name"] = req.last_name.strip()

    if "name" not in update_data and ("first_name" in update_data or "last_name" in update_data):
        first = update_data.get("first_name", emp.get("first_name", ""))
        last = update_data.get("last_name", emp.get("last_name", ""))
        update_data["name"] = f"{first} {last}".strip()

    if req.email is not None and req.email.strip():
        clean_email = req.email.strip().lower()
        duplicate = emp_col.find_one({
            "email": clean_email,
            "employee_id": {"$ne": canonical_id}
        })
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Another employee already uses email '{clean_email}'."
            )
        update_data["email"] = clean_email

    if req.department_id is not None and req.department_id.strip():
        update_data["department_id"] = req.department_id.strip()
    if req.role is not None and req.role.strip():
        update_data["role"] = req.role.strip()
    if req.access_role is not None and req.access_role.strip():
        update_data["access_role"] = req.access_role.strip().upper()
    if req.status is not None and req.status.strip():
        update_data["status"] = req.status.strip().upper()
    if req.trust_score is not None:
        update_data["trust_score"] = max(0, min(100, int(req.trust_score)))

    now_iso = datetime.utcnow().isoformat()
    update_data["updated_at"] = now_iso

    emp_col.update_one(
        {"employee_id": canonical_id},
        {"$set": update_data}
    )

    updated_emp = emp_col.find_one({"employee_id": canonical_id})
    updated_emp["_id"] = str(updated_emp["_id"])

    # Synchronize corresponding user account in `users` collection
    target_email = updated_emp.get("email", old_email)
    user_updates: Dict[str, Any] = {
        "name": updated_emp.get("name"),
        "email": target_email,
        "department": updated_emp.get("department_id"),
        "employee_id": canonical_id,
        "job_title": updated_emp.get("role"),
        "status": updated_emp.get("status", "ACTIVE"),
        "is_active": str(updated_emp.get("status", "ACTIVE")).upper() == "ACTIVE",
        "updated_at": now_iso
    }
    if "access_role" in update_data:
        user_updates["role"] = update_data["access_role"]
    if req.password and req.password.strip():
        user_updates["password_hash"] = hash_password(req.password.strip())

    existing_user = users_col.find_one({"$or": [{"employee_id": canonical_id}, {"email": old_email}, {"email": target_email}]})
    if existing_user:
        users_col.update_one({"_id": existing_user["_id"]}, {"$set": user_updates})
    else:
        user_updates["role"] = updated_emp.get("access_role", "EMPLOYEE")
        user_updates["password_hash"] = hash_password(req.password.strip() if req.password and req.password.strip() else "Employee@123")
        user_updates["created_at"] = now_iso
        users_col.insert_one(user_updates)

    record_audit_log(
        action="EMPLOYEE_UPDATED",
        entity_type="EMPLOYEE",
        entity_id=canonical_id,
        user_id="ADMIN",
        description=f"Employee profile {canonical_id} ({updated_emp.get('name')}) updated (Status: {updated_emp.get('status')})."
    )

    return ApiResponse(
        success=True,
        data=updated_emp,
        message=f"Employee {updated_emp.get('name', canonical_id)} updated successfully."
    )

