from pydantic import BaseModel
from typing import Optional

class AuditLogResponse(BaseModel):
    id: Optional[str] = None
    action: str
    entity_type: str
    entity_id: str
    user_id: str
    description: str
    result: Optional[str] = "SUCCESS"
    timestamp: str
