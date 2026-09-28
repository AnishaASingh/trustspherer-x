import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status

from database import get_employees_collection, get_assets_collection, get_incidents_collection
from schemas.employees import EmployeeCreateRequest, EmployeeUpdateRequest, EmployeeResponse
from schemas.common import ApiResponse, ApiErrorResponse
from utils.audit import record_audit_log

router = APIRouter(prefix="/api/employees", tags=["Employees"])


@router.get("", response_model=ApiResponse[Dict[str, Any]])
@router.get("/", response_model=ApiResponse[Dict[str, Any]])
def list_employees(
    department: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500)
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
        # Format convenience name field if needed
        if "name" not in e:
            e["name"] = f"{e.get('first_name', '')} {e.get('last_name', '')}".strip()

    return ApiResponse(
        success=True,
        data={"count": len(employees), "employees": employees}
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ApiResponse[Dict[str, Any]])
@router.post("/", status_code=status.HTTP_201_CREATED, response_model=ApiResponse[Dict[str, Any]])
def create_employee(req: EmployeeCreateRequest):
    emp_col = get_employees_collection()
    clean_email = req.email.strip().lower()

    existing = emp_col.find_one({"email": clean_email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An employee with email '{clean_email}' already exists."
        )

    employee_id = f"EMP-{uuid.uuid4().hex[:6].upper()}"
    now_iso = datetime.utcnow().isoformat()
    full_name = f"{req.first_name.strip()} {req.last_name.strip()}"

    doc = {
        "employee_id": employee_id,
        "first_name": req.first_name.strip(),
        "last_name": req.last_name.strip(),
        "name": full_name,
        "email": clean_email,
        "department_id": req.department_id,
        "role": req.role.strip(),
        "status": req.status or "ACTIVE",
        "trust_score": 88,
        "created_at": now_iso,
        "updated_at": now_iso
    }

    result = emp_col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    # Record audit log (Phase 2 Section 5 & 7)
    record_audit_log(
        action="EMPLOYEE_CREATED",
        entity_type="EMPLOYEE",
        entity_id=employee_id,
        user_id="operator",
        description=f"Employee profile created: {full_name} ({clean_email}) in {req.department_id} as {req.role}."
    )

    return ApiResponse(
        success=True,
        data=doc,
        message=f"Employee {full_name} added successfully."
    )


@router.get("/{employee_id}", response_model=ApiResponse[Dict[str, Any]])
def get_employee_details(employee_id: str):
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

    # Query associated assets and incidents
    assets_col = get_assets_collection()
    inc_col = get_incidents_collection()

    dept_name = emp.get("department_id", "")
    associated_assets = list(assets_col.find({"department_id": dept_name}).limit(10))
    for a in associated_assets:
        a["_id"] = str(a["_id"])

    associated_incidents = list(inc_col.find({"department_id": dept_name}).limit(10))
    for i in associated_incidents:
        i["_id"] = str(i["_id"])

    emp["associated_assets"] = associated_assets
    emp["related_incidents"] = associated_incidents

    return ApiResponse(success=True, data={"employee": emp})


@router.patch("/{employee_id}", response_model=ApiResponse[Dict[str, Any]])
def update_employee(employee_id: str, req: EmployeeUpdateRequest):
    emp_col = get_employees_collection()
    emp = emp_col.find_one({"employee_id": employee_id})
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee '{employee_id}' not found."
        )

    update_data: Dict[str, Any] = {}
    if req.first_name is not None:
        update_data["first_name"] = req.first_name.strip()
    if req.last_name is not None:
        update_data["last_name"] = req.last_name.strip()
    if req.email is not None:
        update_data["email"] = req.email.strip().lower()
    if req.department_id is not None:
        update_data["department_id"] = req.department_id
    if req.role is not None:
        update_data["role"] = req.role.strip()
    if req.status is not None:
        update_data["status"] = req.status

    first = update_data.get("first_name", emp.get("first_name", ""))
    last = update_data.get("last_name", emp.get("last_name", ""))
    update_data["name"] = f"{first} {last}".strip()
    now_iso = datetime.utcnow().isoformat()
    update_data["updated_at"] = now_iso

    emp_col.update_one(
        {"employee_id": employee_id},
        {"$set": update_data}
    )

    # Record audit log (Phase 2 Section 5 & 7)
    record_audit_log(
        action="EMPLOYEE_UPDATED",
        entity_type="EMPLOYEE",
        entity_id=employee_id,
        user_id="operator",
        description=f"Employee profile {employee_id} updated: {list(update_data.keys())}."
    )

    updated_emp = emp_col.find_one({"employee_id": employee_id})
    updated_emp["_id"] = str(updated_emp["_id"])

    return ApiResponse(
        success=True,
        data=updated_emp,
        message=f"Employee {employee_id} updated successfully."
    )
