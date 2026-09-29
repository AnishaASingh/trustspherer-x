from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from database import (
    get_departments_collection,
    get_employees_collection,
    get_assets_collection,
    get_incidents_collection,
    get_trust_scores_collection
)
from schemas.common import ApiResponse
from utils.security import require_admin_when_authenticated

router = APIRouter(
    prefix="/api/digital-twin",
    tags=["Digital Twin"],
    dependencies=[Depends(require_admin_when_authenticated)]
)

@router.get("/overview", response_model=ApiResponse[Dict[str, Any]])
def get_digital_twin_overview():
    dept_col = get_departments_collection()
    emp_col = get_employees_collection()
    asset_col = get_assets_collection()
    inc_col = get_incidents_collection()

    real_asset_filter: Dict[str, Any] = {
        "$and": [
            {"is_demo": {"$ne": True}},
            {"email_metadata.is_demo": {"$ne": True}},
            {"email_metadata.simulated": {"$ne": True}},
            {"ingestion_mode": {"$ne": "DEMO"}},
            {"email_metadata.ingestion_mode": {"$ne": "DEMO"}},
            {"source": {"$not": {"$regex": "DEV/TEST DEMO|Simulated", "$options": "i"}}}
        ]
    }
    demo_asset_ids = [
        doc.get("asset_id")
        for doc in asset_col.find(
            {
                "$or": [
                    {"is_demo": True},
                    {"email_metadata.is_demo": True},
                    {"email_metadata.simulated": True},
                    {"ingestion_mode": "DEMO"},
                    {"email_metadata.ingestion_mode": "DEMO"},
                    {"source": {"$regex": "DEV/TEST DEMO|Simulated", "$options": "i"}}
                ]
            },
            {"asset_id": 1, "_id": 0}
        )
        if doc.get("asset_id")
    ]
    real_inc_filter: Dict[str, Any] = {"is_demo": {"$ne": True}}
    if demo_asset_ids:
        real_inc_filter["asset_id"] = {"$nin": demo_asset_ids}

    assets = list(asset_col.find(real_asset_filter))
    for a in assets:
        a["_id"] = str(a["_id"])

    incidents = list(inc_col.find(real_inc_filter))
    for i in incidents:
        i["_id"] = str(i["_id"])

    employees = list(emp_col.find({}))
    for e in employees:
        e["_id"] = str(e["_id"])

    depts = list(dept_col.find({}))
    for d in depts:
        d["_id"] = str(d["_id"])
        dept_name = d.get("name", "")
        dept_lower = dept_name.lower()
        dept_assets = [a for a in assets if str(a.get("department_id", "")).lower() == dept_lower]
        dept_emps = [e for e in employees if str(e.get("department_id", "")).lower() == dept_lower]
        dept_incs = [i for i in incidents if str(i.get("department_id", "")).lower() == dept_lower]
        d["employee_count"] = len(dept_emps)
        d["asset_count"] = len(dept_assets)
        d["incident_count"] = len(dept_incs)
        dept_scores = [float(a["trust_score"]) for a in dept_assets if isinstance(a.get("trust_score"), (int, float))]
        d["trust_score"] = round(sum(dept_scores) / len(dept_scores), 1) if dept_scores else None

    overall_score = None
    if assets:
        scores = [float(a["trust_score"]) for a in assets if isinstance(a.get("trust_score"), (int, float))]
        if scores:
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
