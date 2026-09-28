from fastapi import APIRouter, HTTPException, Query, status
from typing import Optional, List, Dict, Any
from datetime import datetime

from database import get_incidents_collection
from schemas.incidents import IncidentStatusUpdateRequest, IncidentResponse
from schemas.common import ApiResponse, ApiErrorResponse
from utils.audit import record_audit_log

router = APIRouter(prefix="/api/incidents", tags=["Incidents"])


@router.get("", response_model=ApiResponse[Dict[str, Any]])
@router.get("/", response_model=ApiResponse[Dict[str, Any]])
def list_incidents(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    department: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500)
):
    query: Dict[str, Any] = {}
    if severity and severity.upper() != "ALL":
        query["severity"] = {"$regex": f"^{severity}$", "$options": "i"}
    if status and status.upper() != "ALL":
        query["status"] = {"$regex": f"^{status}$", "$options": "i"}
    if department and department.upper() != "ALL":
        query["department_id"] = {"$regex": f"^{department}$", "$options": "i"}

    inc_col = get_incidents_collection()
    incidents = list(inc_col.find(query).sort("created_at", -1).limit(limit))
    for inc in incidents:
        inc["_id"] = str(inc["_id"])
        # Format id field
        if "id" not in inc:
            inc["id"] = inc.get("incident_id")

    return ApiResponse(
        success=True,
        data={"count": len(incidents), "incidents": incidents}
    )


@router.get("/{incident_id}", response_model=ApiResponse[Dict[str, Any]])
def get_incident(incident_id: str):
    inc_col = get_incidents_collection()
    inc = inc_col.find_one({"incident_id": incident_id})
    if not inc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found."
        )

    inc["_id"] = str(inc["_id"])
    return ApiResponse(success=True, data={"incident": inc})


@router.patch("/{incident_id}/status", response_model=ApiResponse[Dict[str, Any]])
def update_incident_status(incident_id: str, body: IncidentStatusUpdateRequest):
    inc_col = get_incidents_collection()
    inc = inc_col.find_one({"incident_id": incident_id})
    if not inc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found."
        )

    now_iso = datetime.utcnow().isoformat()
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M")

    timeline = inc.get("timeline", [])
    timeline.append({
        "step": f"Status updated to {body.status}",
        "time": now_str,
        "status": "completed",
        "note": body.note or f"Operator transitioned incident status from {inc.get('status')} to {body.status}."
    })

    update_fields: Dict[str, Any] = {
        "status": body.status,
        "timeline": timeline,
        "updated_at": now_iso
    }

    if body.status == "RESOLVED":
        update_fields["resolved_at"] = now_iso

    inc_col.update_one(
        {"incident_id": incident_id},
        {"$set": update_fields}
    )

    # Record audit log (Phase 2 Section 4)
    record_audit_log(
        action="INCIDENT_STATUS_UPDATED",
        entity_type="INCIDENT",
        entity_id=incident_id,
        user_id="operator",
        description=f"Incident {incident_id} status updated to {body.status}. {body.note or ''}".strip(),
        result="SUCCESS"
    )

    return ApiResponse(
        success=True,
        data={
            "incident_id": incident_id,
            "previous_status": inc.get("status"),
            "new_status": body.status,
            "updated_at": now_iso
        },
        message=f"Incident {incident_id} status successfully transitioned to {body.status}."
    )
