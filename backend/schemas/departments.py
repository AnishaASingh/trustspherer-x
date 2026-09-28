from pydantic import BaseModel, Field
from typing import Optional

class DepartmentCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = ""
    status: Optional[str] = "ACTIVE"

class DepartmentUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

class DepartmentResponse(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = ""
    status: Optional[str] = "ACTIVE"
    employee_count: Optional[int] = 0
    asset_count: Optional[int] = 0
    incident_count: Optional[int] = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
