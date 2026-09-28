from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from services.ai_service import (
    get_ai_status,
    analyze_asset_by_id,
    analyze_incident_by_id,
    analyze_digital_twin_state,
    chat_with_ai_assistant,
)
from utils.security import get_current_user
from utils.audit import record_audit_log

router = APIRouter(prefix="/api/ai", tags=["AI Decision Intelligence (Groq)"])


# ============================================================
# REQUEST SCHEMAS
# ============================================================

class AnalyzeAssetRequest(BaseModel):
    asset_id: str = Field(..., min_length=1, description="Target Asset ID (e.g., AST-XXXXXX)")


class AnalyzeIncidentRequest(BaseModel):
    incident_id: str = Field(..., min_length=1, description="Target Incident ID (e.g., INC-XXXXXX)")


class AnalyzeDigitalTwinRequest(BaseModel):
    department_filter: Optional[str] = Field(None, description="Optional department name filter")


class AIChatRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=1000, description="Analytical question for TrustSphere AI")
    context_type: Optional[str] = Field(
        "dashboard",
        description="Context scope: 'asset', 'incident', 'digital_twin', or 'dashboard'"
    )
    entity_id: Optional[str] = Field(None, description="Optional entity ID (asset_id or incident_id)")


# ============================================================
# ENDPOINTS (ALL REQUIRE VALID AUTHENTICATION)
# ============================================================

@router.get("/status")
def ai_service_status(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Returns operational telemetry and model configuration for the Groq AI layer."""
    return {
        "success": True,
        "data": get_ai_status()
    }


@router.post("/analyze-asset")
def ai_analyze_asset(
    req: AnalyzeAssetRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Analyzes a verified digital asset using real 7-layer telemetry from MongoDB
    and generates a structured explanation (FACTS, INFERENCES, RECOMMENDATIONS) via Groq.
    """
    try:
        ai_data = analyze_asset_by_id(req.asset_id.strip())
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err)
        )

    # Unwrap if wrapped, or use directly
    payload = ai_data.get("data", ai_data) if isinstance(ai_data, dict) else ai_data

    record_audit_log(
        action="AI_ASSET_ANALYZED",
        entity_type="ASSET",
        entity_id=req.asset_id.strip(),
        user_id=current_user.get("email", "Authenticated User"),
        description=f"AI Decision Intelligence analysis executed on asset {req.asset_id.strip()} using {payload.get('model_used') or payload.get('model')}."
    )

    return {
        "success": True,
        "data": payload,
        "asset_id": req.asset_id.strip()
    }


@router.post("/analyze-incident")
def ai_analyze_incident(
    req: AnalyzeIncidentRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Analyzes a security incident and its associated digital asset, department,
    and 7-layer verification findings to generate root-cause explanation and remediation steps.
    """
    try:
        ai_data = analyze_incident_by_id(req.incident_id.strip())
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err)
        )

    payload = ai_data.get("data", ai_data) if isinstance(ai_data, dict) else ai_data

    record_audit_log(
        action="AI_INCIDENT_ANALYZED",
        entity_type="INCIDENT",
        entity_id=req.incident_id.strip(),
        user_id=current_user.get("email", "Authenticated User"),
        description=f"AI Incident root-cause analysis executed on incident {req.incident_id.strip()}."
    )

    return {
        "success": True,
        "data": payload,
        "incident_id": req.incident_id.strip(),
        "asset_id": payload.get("asset_id")
    }


@router.post("/analyze-digital-twin")
def ai_analyze_digital_twin(
    req: Optional[AnalyzeDigitalTwinRequest] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Analyzes the live organizational Digital Twin state across all departments,
    identifying highest-risk nodes, asset anomalies, and active incident bottlenecks.
    """
    try:
        ai_data = analyze_digital_twin_state()
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze Digital Twin state: {str(err)}"
        )

    payload = ai_data.get("data", ai_data) if isinstance(ai_data, dict) else ai_data

    record_audit_log(
        action="AI_DIGITAL_TWIN_ANALYZED",
        entity_type="DIGITAL_TWIN",
        entity_id="ORG-TWIN",
        user_id=current_user.get("email", "Authenticated User"),
        description="AI organizational Digital Twin posture analysis executed."
    )

    return {
        "success": True,
        "data": payload,
        "twin_metrics": payload.get("digital_twin_metrics", {})
    }


@router.post("/chat")
def ai_security_assistant_chat(
    req: AIChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Controlled TrustSphere AI Security Assistant.
    Answers analytical questions strictly grounded in live MongoDB records
    (assets, verifications, incidents, departments, Digital Twin).
    """
    try:
        ai_data = chat_with_ai_assistant(
            question=req.question.strip(),
            context_type=req.context_type or "dashboard",
            entity_id=req.entity_id
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )

    payload = ai_data.get("data", ai_data) if isinstance(ai_data, dict) else ai_data

    record_audit_log(
        action="AI_ASSISTANT_QUERY",
        entity_type=(req.context_type or "DASHBOARD").upper(),
        entity_id=req.entity_id or "GLOBAL",
        user_id=current_user.get("email", "Authenticated User"),
        description=f"AI Assistant query ({req.context_type or 'dashboard'}): '{req.question[:80]}'"
    )

    return {
        "success": True,
        "data": payload,
        "question": req.question.strip(),
        "context_type": req.context_type or "dashboard",
        "entity_id": req.entity_id
    }
