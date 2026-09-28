from fastapi import APIRouter
from typing import Dict, Any

from database import (
    get_assets_collection,
    get_incidents_collection,
    get_employees_collection,
    get_departments_collection
)
from schemas.dashboard import DashboardMetricsResponse
from schemas.common import ApiResponse

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/metrics", response_model=ApiResponse[DashboardMetricsResponse])
def get_dashboard_metrics():
    assets_col = get_assets_collection()
    inc_col = get_incidents_collection()
    emp_col = get_employees_collection()
    dept_col = get_departments_collection()

    total_assets = assets_col.count_documents({})
    total_incidents = inc_col.count_documents({})
    open_incidents = inc_col.count_documents({
        "status": {"$in": ["OPEN", "INVESTIGATING", "UNDER INVESTIGATION"]}
    })
    critical_incidents = inc_col.count_documents({
        "severity": {"$regex": "^CRITICAL", "$options": "i"}
    })

    high_risk_assets = assets_col.count_documents({
        "$or": [
            {"risk_level": {"$regex": "^High", "$options": "i"}},
            {"risk_level": {"$regex": "^Critical", "$options": "i"}}
        ]
    })
    medium_risk_assets = assets_col.count_documents({
        "risk_level": {"$regex": "^Medium", "$options": "i"}
    })
    low_risk_assets = assets_col.count_documents({
        "risk_level": {"$regex": "^Low", "$options": "i"}
    })

    # Average trust score calculation
    avg_score = 0.0
    if total_assets > 0:
        pipeline = [
            {"$group": {"_id": None, "avg_score": {"$avg": "$trust_score"}}}
        ]
        agg_result = list(assets_col.aggregate(pipeline))
        if agg_result and "avg_score" in agg_result[0] and agg_result[0]["avg_score"] is not None:
            avg_score = round(float(agg_result[0]["avg_score"]), 2)

    total_employees = emp_col.count_documents({})
    total_departments = dept_col.count_documents({})

    metrics = DashboardMetricsResponse(
        total_assets=total_assets,
        total_incidents=total_incidents,
        open_incidents=open_incidents,
        critical_incidents=critical_incidents,
        high_risk_assets=high_risk_assets,
        medium_risk_assets=medium_risk_assets,
        low_risk_assets=low_risk_assets,
        average_trust_score=avg_score,
        total_employees=total_employees,
        total_departments=total_departments,
        risk_distribution={
            "LOW": low_risk_assets,
            "MEDIUM": medium_risk_assets,
            "HIGH": high_risk_assets,
            "CRITICAL": critical_incidents
        }
    )

    return ApiResponse(
        success=True,
        data=metrics,
        message="Dashboard metrics calculated dynamically from MongoDB."
    )
