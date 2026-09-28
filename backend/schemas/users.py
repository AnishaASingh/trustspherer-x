from pydantic import BaseModel, Field
from typing import Optional, List

class UserAdminCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=150)
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field("Security Analyst", min_length=2, max_length=50)
    department: Optional[str] = None
    employee_id: Optional[str] = None
    status: Optional[str] = "ACTIVE"

class UserAdminUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    role: Optional[str] = Field(None, min_length=2, max_length=50)
    department: Optional[str] = None
    employee_id: Optional[str] = None
    status: Optional[str] = None

class UserAdminStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(ACTIVE|INACTIVE)$")

class UserAdminPasswordResetRequest(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=128)

class UserAdminResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    department: Optional[str] = None
    employee_id: Optional[str] = None
    status: str = "ACTIVE"
    is_active: bool = True
    created_at: str
    updated_at: Optional[str] = None

class UserAdminListResponse(BaseModel):
    count: int
    users: List[UserAdminResponse]
