from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends
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
from utils.security import require_admin_when_authenticated

router = APIRouter(
    prefix="/api/departments",
    tags=["Departments"],
    dependencies=[Depends(require_admin_when_authenticated)]
)


def _enrich_department_stats(d: Dict[str, Any]) -> Dict[str, Any]:
    d["_id"] = str(d["_id"])
    dept_name = d.get("name", "")
    assets_col = get_assets_collection()
    inc_col = get_incidents_collection()

    real_dept_asset_query: Dict[str, Any] = {
        "$and": [
            {"department_id": {"$regex": f"^{dept_name}$", "$options": "i"}},
            {"is_demo": {"$ne": True}},
            {"email_metadata.is_demo": {"$ne": True}},
            {"email_metadata.simulated": {"$ne": True}},
            {"ingestion_mode": {"$ne": "DEMO"}},
            {"email_metadata.ingestion_mode": {"$ne": "DEMO"}},
            {"source": {"$not": {"$regex": "DEV/TEST DEMO|Simulated", "$options": "i"}}}
        ]
    }
    dept_assets = list(assets_col.find(real_dept_asset_query, {"trust_score": 1, "_id": 0}))
    asset_count = len(dept_assets)

    d["employee_count"] = get_employees_collection().count_documents({
        "department_id": {"$regex": f"^{dept_name}$", "$options": "i"}
    })
    d["asset_count"] = asset_count
    d["incident_count"] = inc_col.count_documents({
        "department_id": {"$regex": f"^{dept_name}$", "$options": "i"},
        "is_demo": {"$ne": True}
    })

    scores = [float(a["trust_score"]) for a in dept_assets if isinstance(a.get("trust_score"), (int, float))]
    if scores:
        avg_score = round(sum(scores) / len(scores), 1)
        d["trust_score"] = avg_score
        d["risk_tier"] = "HIGH" if avg_score < 60 else ("MEDIUM" if avg_score < 75 else "LOW")
        d["compliance_status"] = "VERIFIED"
    else:
        d["trust_score"] = None
        d["risk_tier"] = "N/A"
        d["compliance_status"] = "Awaiting verification"

    return d


@router.get("", response_model=ApiResponse[Dict[str, Any]])
@router.get("/", response_model=ApiResponse[Dict[str, Any]])
def list_departments():
    dept_col = get_departments_collection()
    depts = [_enrich_department_stats(d) for d in dept_col.find()]

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

    dept = _enrich_department_stats(dept)

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
