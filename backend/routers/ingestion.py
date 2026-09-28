import os
from typing import Optional, List, Dict, Any, Union
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, status, Body
from pydantic import BaseModel, Field

from services.ingestion_service import (
    get_ingestion_status,
    scan_incoming_folder,
    process_single_ingestion_file
)
from services.email_ingestion import (
    get_email_ingestion_status,
    get_email_settings,
    update_email_settings,
    test_email_connection,
    get_recent_ingested_emails,
    poll_email_inbox,
    simulate_email_intake,
    get_oauth_integration_status,
    initiate_gmail_oauth_connect,
    complete_gmail_oauth_callback,
    disconnect_gmail_oauth,
    get_email_filter_rules,
    update_email_filter_rules
)
from services.ai_intelligence import get_ai_status
from database import get_audit_logs_collection, get_assets_collection

router = APIRouter(prefix="/api/ingestion", tags=["Automatic Ingestion & Intelligence"])


class EmailFilterRulesUpdate(BaseModel):
    allowed_senders: Optional[Union[List[str], str]] = None
    subject_keywords: Optional[Union[List[str], str]] = None
    require_attachment: Optional[bool] = None
    allowed_extensions: Optional[Union[List[str], str]] = None
    max_file_size_mb: Optional[int] = Field(None, ge=1, le=50)


class EmailSettingsUpdateRequest(BaseModel):
    enabled: Optional[bool] = None
    server: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    folder: Optional[str] = None
    analysis_mode: Optional[str] = Field(None, pattern="^(both|attachments|body)$")
    poll_interval: Optional[int] = Field(None, ge=10, le=3600)
    use_ssl: Optional[bool] = None
    filter_rules: Optional[Dict[str, Any]] = None


class TestConnectionRequest(BaseModel):
    server: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None  # Tested ephemerally in memory, NEVER saved


# ============================================================
# 1. OVERALL INGESTION STATUS & AI TELEMETRY
# ============================================================
@router.get("/status")
def get_status():
    """Returns real-time health and metrics for watched folder, email ingestion, and AI intelligence."""
    folder_status = get_ingestion_status()
    email_status = get_email_ingestion_status()
    ai_status = get_ai_status()

    return {
        "success": True,
        "data": {
            "watched_folder": folder_status,
            "email_ingestion": email_status,
            "ai_intelligence": ai_status
        }
    }


@router.get("/ai/status")
def get_ai_intelligence_status():
    """Returns the operational status of the Groq AI Intelligence layer."""
    return {
        "success": True,
        "data": get_ai_status()
    }


# ============================================================
# 2. GMAIL OAUTH 2.0 INTEGRATION (EMAIL_INTEGRATIONS COLLECTION)
# ============================================================
@router.get("/email/oauth/status")
def get_gmail_oauth_status():
    """
    Returns the Gmail OAuth mailbox integration status from the `email_integrations` collection.
    Note: admin@trustsphere.com is NOT automatically the monitored mailbox.
    """
    return {
        "success": True,
        "data": get_oauth_integration_status()
    }


@router.post("/email/oauth/connect")
def connect_gmail_oauth():
    """
    Initiates Gmail OAuth 2.0 connection.
    Never pretends a real Gmail mailbox is connected if GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not configured.
    """
    res = initiate_gmail_oauth_connect()
    return {
        "success": res.get("success", False),
        "data": res,
        "message": res.get("message", "OAuth check completed.")
    }


@router.get("/email/oauth/callback")
def gmail_oauth_callback(
    code: str = Query(..., description="OAuth 2.0 authorization code from Google"),
    state: Optional[str] = Query(None),
    email: Optional[str] = Query(None)
):
    """Handles Google OAuth 2.0 callback when Google Cloud credentials are configured."""
    res = complete_gmail_oauth_callback(code=code, email_address=email)
    if not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.get("message", "OAuth callback failed.")
        )
    return res


@router.post("/email/oauth/disconnect")
def disconnect_gmail():
    """Disconnects the OAuth mailbox and sets status to Not Connected in MongoDB."""
    return disconnect_gmail_oauth()


# ============================================================
# 3. EMAIL SAFETY & FILTERING RULES
# ============================================================
@router.get("/email/filters")
def get_email_filters():
    """Returns the active email safety & filtering rules."""
    return {
        "success": True,
        "data": get_email_filter_rules()
    }


@router.patch("/email/filters")
def patch_email_filters(req: EmailFilterRulesUpdate):
    """Updates email safety & filtering rules (sender, subject keywords, attachment presence, allowed extensions)."""
    updates = req.model_dump(exclude_unset=True)
    updated = update_email_filter_rules(updates)
    return {
        "success": True,
        "data": updated,
        "message": "Email safety & filtering rules updated."
    }


# ============================================================
# 4. EMAIL INTEGRATION SETTINGS & CONNECTION TEST
# ============================================================
@router.get("/email/settings")
def get_email_configuration():
    """Returns email integration settings, OAuth connection state, and filter rules. Passwords are never returned."""
    return {
        "success": True,
        "data": get_email_settings()
    }


@router.patch("/email/settings")
def update_email_configuration(req: EmailSettingsUpdateRequest):
    """
    Updates email ingestion settings (enabled, folder, analysis_mode, poll_interval, filter_rules).
    Passwords are never persisted to MongoDB.
    """
    updates = req.model_dump(exclude_unset=True)
    updated = update_email_settings(updates)
    return {
        "success": True,
        "data": updated,
        "message": "Email integration settings updated successfully."
    }


@router.post("/email/test-connection")
def run_test_connection(req: TestConnectionRequest = Body(default=TestConnectionRequest())):
    """
    Tests mailbox connection status.
    """
    result = test_email_connection(
        server=req.server,
        port=req.port,
        username=req.username,
        password=req.password
    )
    return {
        "success": result.get("success", False),
        "data": result,
        "message": result.get("message", "Connection test completed.")
    }


# ============================================================
# 5. RECENT INGESTED EMAILS & TRACEABILITY
# ============================================================
@router.get("/email/recent")
def list_recent_emails(limit: int = Query(25, ge=1, le=100)):
    """
    Returns recent ingested emails with traceability metadata:
    email_id, sender, subject, received_time, attachments, verification result, asset_id, is_demo.
    """
    in_memory_events = get_recent_ingested_emails(limit=limit)

    db_email_assets = list(
        get_assets_collection().find(
            {"source": {"$regex": "Email Ingestion", "$options": "i"}},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit)
    )

    return {
        "success": True,
        "data": {
            "count": len(in_memory_events),
            "recent_emails": in_memory_events,
            "database_assets": db_email_assets
        }
    }


# ============================================================
# 6. MANUAL TRIGGER & DEMO EMAIL INGESTION
# ============================================================
@router.post("/email/poll")
def trigger_email_poll(department: Optional[str] = Query("Operations")):
    """Forces an immediate manual check and scan of the configured mailbox."""
    res = poll_email_inbox(department=department)
    return {
        "success": True,
        "data": res
    }


@router.post("/email/demo")
@router.post("/email/simulate")
async def demo_email_ingestion(
    file: Optional[UploadFile] = File(None),
    sender: str = Form("partner@external-corp.com"),
    subject: str = Form("Quarterly Confidential Security Audit Report"),
    body_text: Optional[str] = Form("Please find attached the security compliance review and audit logs for your team's immediate evaluation."),
    department: str = Form("Operations"),
    message_id: Optional[str] = Form(None)
):
    """
    Clearly labelled DEMO EMAIL INGESTION mode.
    Validates against email safety & filtering rules, then runs through the full
    7-layer TrustSphere verification pipeline + Groq AI analysis + Digital Twin update.
    Clearly labels records with `is_demo: True` and `ingestion_mode: "DEMO"`.
    """
    filename = None
    file_bytes = None

    if file and file.filename:
        filename = file.filename
        file_bytes = await file.read()

    result = simulate_email_intake(
        sender=sender,
        subject=subject,
        body_text=body_text,
        filename=filename,
        file_bytes=file_bytes,
        department=department,
        message_id=message_id
    )

    if result.get("rejected"):
        return {
            "success": False,
            "data": result,
            "message": result.get("reason", "Email rejected by safety & filtering policy.")
        }

    return {
        "success": True,
        "data": result,
        "message": f"[DEMO MODE] Email ingested and verified. Generated {len(result.get('created_assets', []))} digital asset(s)."
    }


# ============================================================
# 7. WATCHED FOLDER & AUDIT HISTORY
# ============================================================
@router.post("/scan")
def trigger_folder_scan(department: Optional[str] = Query("Operations", description="Department to assign ingested files")):
    """Forces an immediate on-demand scan of the incoming folder."""
    results = scan_incoming_folder(department=department)
    return {
        "success": True,
        "data": {
            "processed_count": len(results),
            "results": results
        }
    }


@router.get("/history")
def get_ingestion_history(limit: int = Query(25, ge=1, le=100)):
    """Retrieves ingestion audit history and event telemetry from MongoDB."""
    logs_cursor = get_audit_logs_collection().find(
        {
            "action": {
                "$in": [
                    "ASSET_INGESTED",
                    "EMAIL_INGESTED",
                    "DUPLICATE_ASSET_SKIPPED",
                    "INGESTION_FAILED",
                    "ASSET_VERIFIED",
                    "EMAIL_OAUTH_INITIATED",
                    "EMAIL_OAUTH_CONNECTED",
                    "EMAIL_OAUTH_DISCONNECTED",
                    "EMAIL_FILTER_RULES_UPDATED"
                ]
            }
        }
    ).sort("timestamp", -1).limit(limit)

    logs = []
    for log in logs_cursor:
        log["_id"] = str(log["_id"])
        logs.append(log)

    return {
        "success": True,
        "data": {
            "total": len(logs),
            "events": logs
        }
    }
