from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class IncidentStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(OPEN|INVESTIGATING|RESOLVED|DISMISSED)$")
    note: Optional[str] = None

class IncidentResponse(BaseModel):
    id: Optional[str] = None
    incident_id: str
    asset_id: str
    title: str
    description: str
    severity: str
    status: str
    department_id: Optional[str] = None
    assigned_to: Optional[str] = None
    detected_date: Optional[str] = None
    timeline: Optional[List[Dict[str, Any]]] = None
    created_at: str
    updated_at: Optional[str] = None
    resolved_at: Optional[str] = None
