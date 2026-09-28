from pydantic import BaseModel, Field
from typing import Optional, Union

class EmployeeCreateRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: str = Field(..., min_length=5, max_length=150)
    department_id: str
    role: str = Field(..., min_length=2, max_length=100)
    status: Optional[str] = "ACTIVE"
    trust_score: Optional[Union[int, float]] = Field(88, ge=0, le=100)
    password: Optional[str] = None
    access_role: Optional[str] = "EMPLOYEE"

class EmployeeUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    department_id: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    trust_score: Optional[Union[int, float]] = Field(None, ge=0, le=100)
    password: Optional[str] = None
    access_role: Optional[str] = None

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
    trust_score: Optional[Union[int, float]] = 88
    access_role: Optional[str] = "EMPLOYEE"
    created_at: str
    updated_at: Optional[str] = None
