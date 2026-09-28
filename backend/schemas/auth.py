from pydantic import BaseModel, Field
from typing import Optional

class UserRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=150)
    password: str = Field(..., min_length=6, max_length=128)
    role: Optional[str] = "Security Administrator"

class UserLoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: str
    updated_at: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    user: UserResponse
