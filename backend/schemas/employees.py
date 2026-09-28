from pydantic import BaseModel, Field
from typing import Optional

class EmployeeCreateRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: str = Field(..., min_length=5, max_length=150)
    department_id: str
    role: str = Field(..., min_length=2, max_length=100)
    status: Optional[str] = "ACTIVE"

class EmployeeUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    department_id: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None

class EmployeeResponse(BaseModel):
    id: Optional[str] = None
    employee_id: str
    first_name: str
    last_name: str
    name: Optional[str] = None
    email: str
    department_id: str
    role: str
    status: str
    created_at: str
    updated_at: Optional[str] = None
