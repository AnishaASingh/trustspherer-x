from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status
from bson import ObjectId

from database import (
    get_departments_collection,
    get_employees_collection,
    get_assets_collection,
    get_incidents_collection
)
from schemas.departments import DepartmentCreateRequest, DepartmentUpdateRequest, DepartmentResponse
from schemas.common import ApiResponse, ApiErrorResponse
from utils.audit import record_audit_log

router = APIRouter(prefix="/api/departments", tags=["Departments"])


@router.get("", response_model=ApiResponse[Dict[str, Any]])
@router.get("/", response_model=ApiResponse[Dict[str, Any]])
def list_departments():
    dept_col = get_departments_collection()
    depts = list(dept_col.find())
    for d in depts:
        d["_id"] = str(d["_id"])
        dept_name = d.get("name", "")
        d["employee_count"] = get_employees_collection().count_documents({
            "department_id": {"$regex": f"^{dept_name}$", "$options": "i"}
        })
        d["asset_count"] = get_assets_collection().count_documents({
            "department_id": {"$regex": f"^{dept_name}$", "$options": "i"}
        })
        d["incident_count"] = get_incidents_collection().count_documents({
            "department_id": {"$regex": f"^{dept_name}$", "$options": "i"}
        })

    return ApiResponse(
        success=True,
        data={"count": len(depts), "departments": depts}
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ApiResponse[Dict[str, Any]])
@router.post("/", status_code=status.HTTP_201_CREATED, response_model=ApiResponse[Dict[str, Any]])
def create_department(req: DepartmentCreateRequest):
    dept_col = get_departments_collection()
    clean_name = req.name.strip()

    existing = dept_col.find_one({"name": {"$regex": f"^{clean_name}$", "$options": "i"}})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department '{clean_name}' already exists."
        )

    now_iso = datetime.utcnow().isoformat()
    doc = {
        "name": clean_name,
        "description": req.description or "",
        "status": req.status or "ACTIVE",
        "created_at": now_iso,
        "updated_at": now_iso
    }

    result = dept_col.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    # Record audit log
    record_audit_log(
        action="DEPARTMENT_CREATED",
        entity_type="DEPARTMENT",
        entity_id=clean_name,
        user_id="operator",
        description=f"Department created: '{clean_name}'."
    )

    return ApiResponse(
        success=True,
        data=doc,
        message=f"Department '{clean_name}' created successfully."
    )


@router.get("/{department_id}", response_model=ApiResponse[Dict[str, Any]])
def get_department(department_id: str):
    dept_col = get_departments_collection()
    
    # Allow lookup by name or ObjectId
    query: Dict[str, Any] = {"name": {"$regex": f"^{department_id}$", "$options": "i"}}
    if ObjectId.is_valid(department_id):
        query = {"$or": [{"_id": ObjectId(department_id)}, {"name": {"$regex": f"^{department_id}$", "$options": "i"}}]}

    dept = dept_col.find_one(query)
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department '{department_id}' not found."
        )

    dept["_id"] = str(dept["_id"])
    dept_name = dept.get("name", "")
    dept["employee_count"] = get_employees_collection().count_documents({
        "department_id": {"$regex": f"^{dept_name}$", "$options": "i"}
    })
    dept["asset_count"] = get_assets_collection().count_documents({
        "department_id": {"$regex": f"^{dept_name}$", "$options": "i"}
    })
    dept["incident_count"] = get_incidents_collection().count_documents({
        "department_id": {"$regex": f"^{dept_name}$", "$options": "i"}
    })

    return ApiResponse(success=True, data={"department": dept})


@router.patch("/{department_id}", response_model=ApiResponse[Dict[str, Any]])
def update_department(department_id: str, req: DepartmentUpdateRequest):
    dept_col = get_departments_collection()
    query: Dict[str, Any] = {"name": {"$regex": f"^{department_id}$", "$options": "i"}}
    if ObjectId.is_valid(department_id):
        query = {"$or": [{"_id": ObjectId(department_id)}, {"name": {"$regex": f"^{department_id}$", "$options": "i"}}]}

    dept = dept_col.find_one(query)
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department '{department_id}' not found."
        )

    update_data: Dict[str, Any] = {}
    if req.name is not None:
        update_data["name"] = req.name.strip()
    if req.description is not None:
        update_data["description"] = req.description.strip()
    if req.status is not None:
        update_data["status"] = req.status

    now_iso = datetime.utcnow().isoformat()
    update_data["updated_at"] = now_iso

    dept_col.update_one({"_id": dept["_id"]}, {"$set": update_data})

    # Record audit log
    record_audit_log(
        action="DEPARTMENT_UPDATED",
        entity_type="DEPARTMENT",
        entity_id=dept.get("name", str(dept["_id"])),
        user_id="operator",
        description=f"Department {dept.get('name')} updated: {list(update_data.keys())}."
    )

    updated_dept = dept_col.find_one({"_id": dept["_id"]})
    updated_dept["_id"] = str(updated_dept["_id"])

    return ApiResponse(
        success=True,
        data=updated_dept,
        message="Department updated successfully."
    )
