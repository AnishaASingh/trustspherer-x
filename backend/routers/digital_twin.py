from typing import Dict, Any, List
from fastapi import APIRouter
from database import (
    get_departments_collection,
    get_employees_collection,
    get_assets_collection,
    get_incidents_collection,
    get_trust_scores_collection
)
from schemas.common import ApiResponse

router = APIRouter(prefix="/api/digital-twin", tags=["Digital Twin"])

@router.get("/overview", response_model=ApiResponse[Dict[str, Any]])
def get_digital_twin_overview():
    dept_col = get_departments_collection()
    emp_col = get_employees_collection()
    asset_col = get_assets_collection()
    inc_col = get_incidents_collection()

    depts = list(dept_col.find({}))
    for d in depts:
        d["_id"] = str(d["_id"])
        dept_name = d.get("name", "")
        d["employee_count"] = emp_col.count_documents({"department_id": {"$regex": f"^{dept_name}$", "$options": "i"}})
        d["asset_count"] = asset_col.count_documents({"department_id": {"$regex": f"^{dept_name}$", "$options": "i"}})
        d["incident_count"] = inc_col.count_documents({"department_id": {"$regex": f"^{dept_name}$", "$options": "i"}})

    employees = list(emp_col.find({}))
    for e in employees:
        e["_id"] = str(e["_id"])

    assets = list(asset_col.find({}))
    for a in assets:
        a["_id"] = str(a["_id"])

    incidents = list(inc_col.find({}))
    for i in incidents:
        i["_id"] = str(i["_id"])

    overall_score = 100.0
    if assets:
        scores = [float(a.get("trust_score", 50.0)) for a in assets]
        overall_score = round(sum(scores) / len(scores), 1)

    return ApiResponse(
        success=True,
        data={
            "summary": {
                "total_departments": len(depts),
                "total_employees": len(employees),
                "total_assets": len(assets),
                "total_incidents": len(incidents),
                "overall_trust_score": overall_score
            },
            "departments": depts,
            "employees": employees,
            "assets": assets,
            "incidents": incidents
        },
        message="Digital Twin topology aggregated dynamically from live database state."
    )
