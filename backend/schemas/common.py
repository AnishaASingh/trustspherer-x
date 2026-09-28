from typing import Any, Optional, Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")

class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    message: Optional[str] = None

class ApiErrorResponse(BaseModel):
    success: bool = False
    message: str
