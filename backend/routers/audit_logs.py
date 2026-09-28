from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, Depends

from database import get_audit_logs_collection
from schemas.common import ApiResponse
from utils.security import require_admin_when_authenticated

router = APIRouter(
    prefix="/api/audit-logs",
    tags=["Audit Logs"],
    dependencies=[Depends(require_admin_when_authenticated)]
)


@router.get("", response_model=ApiResponse[Dict[str, Any]])
@router.get("/", response_model=ApiResponse[Dict[str, Any]])
def list_audit_logs(
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    result: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500)
):
    query: Dict[str, Any] = {}
    if action and action.upper() != "ALL":
        query["action"] = {"$regex": f"^{action}$", "$options": "i"}
    if entity_type and entity_type.upper() != "ALL":
        query["entity_type"] = {"$regex": f"^{entity_type}$", "$options": "i"}
    if result and result.upper() != "ALL":
        query["result"] = {"$regex": f"^{result}$", "$options": "i"}
    if user_id:
        query["user_id"] = user_id

    log_col = get_audit_logs_collection()
    logs = list(log_col.find(query).sort("timestamp", -1).limit(limit))
    for log in logs:
        log["_id"] = str(log["_id"])

    return ApiResponse(
        success=True,
        data={"count": len(logs), "audit_logs": logs}
    )
