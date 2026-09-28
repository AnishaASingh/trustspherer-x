from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class AssetResponse(BaseModel):
    id: Optional[str] = None
    asset_id: str
    filename: str
    file_type: str
    file_size: str
    department_id: str
    source: Optional[str] = None
    category: Optional[str] = None
    upload_date: str
    status: str
    trust_score: float
    risk_level: str
    file_hash: str
    created_at: Optional[str] = None

class VerificationCheck(BaseModel):
    name: str
    passed: bool
    detail: str

class VerifyResponseData(BaseModel):
    asset_id: str
    verification_id: str
    trust_score_id: Optional[str] = None
    trust_score: float
    risk_level: str
    checks: List[Dict[str, Any]]
    factors: Dict[str, Any]
    anomalies: List[str]
    recommendations: List[str]
    incident_id: Optional[str] = None
    status: str
    filename: str
    file_hash: str
