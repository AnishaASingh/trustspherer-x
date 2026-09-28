from pydantic import BaseModel
from typing import Dict, Any, Optional

class DashboardMetricsResponse(BaseModel):
    total_assets: int
    total_incidents: int
    open_incidents: int
    critical_incidents: int
    high_risk_assets: int
    medium_risk_assets: int
    low_risk_assets: int
    average_trust_score: float
    total_employees: int
    total_departments: int
    risk_distribution: Optional[Dict[str, int]] = None
