"""
TrustSphere AI Service (Groq API + openai/gpt-oss-20b)
Re-exports the structured AI intelligence functions from services.ai_intelligence
to provide a clean, unified service interface for routers and pipeline modules.
"""

from services.ai_intelligence import (
    TRUSTSPHERE_SYSTEM_PROMPT,
    get_ai_status,
    generate_ai_security_insights,
    analyze_asset_by_id,
    analyze_incident_by_id,
    analyze_digital_twin_state,
    chat_with_ai_assistant,
)

__all__ = [
    "TRUSTSPHERE_SYSTEM_PROMPT",
    "get_ai_status",
    "generate_ai_security_insights",
    "analyze_asset_by_id",
    "analyze_incident_by_id",
    "analyze_digital_twin_state",
    "chat_with_ai_assistant",
]
