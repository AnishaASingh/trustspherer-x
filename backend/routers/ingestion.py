import os
import urllib.parse
from typing import Optional, List, Dict, Any, Union
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, Request, status, Body, Depends
from fastapi.responses import RedirectResponse
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
    sync_gmail_messages,
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
from utils.security import require_admin_when_authenticated

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
    password: Optional[str] = None


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
@router.get("/email/oauth/status", dependencies=[Depends(require_admin_when_authenticated)])
def get_gmail_oauth_status():
    """
    Returns the Gmail OAuth mailbox integration status from the `email_integrations` collection.
    Note: admin@trustsphere.com is NOT automatically the monitored mailbox.
    """
    return {
        "success": True,
        "data": get_oauth_integration_status()
    }


@router.post("/email/oauth/connect", dependencies=[Depends(require_admin_when_authenticated)])
def connect_gmail_oauth():
    """
    Initiates real Google OAuth 2.0 connection.
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
    request: Request,
    code: Optional[str] = Query(None, description="OAuth 2.0 authorization code from Google"),
    state: Optional[str] = Query(None, description="CSRF protection state token"),
    error: Optional[str] = Query(None, description="OAuth error code if user denied or Google returned error"),
    error_description: Optional[str] = Query(None, description="OAuth error description"),
    format: Optional[str] = Query(None, description="Set to 'json' to force JSON response instead of browser redirect")
):
    """
    Handles the Google OAuth 2.0 callback:
    - Validates state & exchanges authorization code for tokens
    - Verifies the connected Gmail address
    - Redirects browser back to Frontend /email-integration page with status, or returns JSON for API callers
    """
    res = complete_gmail_oauth_callback(
        code=code,
        state=state,
        error=error,
        error_description=error_description
    )

    accept_header = (request.headers.get("accept") or "").lower()
    is_browser_navigation = ("text/html" in accept_header) and (format != "json")

    if is_browser_navigation:
        frontend_base = (
            os.environ.get("FRONTEND_URL")
            or os.environ.get("CORS_ORIGIN")
            or "http://localhost:5173"
        ).rstrip("/")

        if res.get("success"):
            connected_email = (res.get("data") or {}).get("email_address") or ""
            params = urllib.parse.urlencode({
                "oauth_status": "success",
                "connected_email": connected_email
            })
            return RedirectResponse(url=f"{frontend_base}/email-integration?{params}", status_code=302)
        else:
            err_msg = res.get("message", "Google OAuth authorization failed.")
            params = urllib.parse.urlencode({
                "oauth_status": "error",
                "oauth_error": err_msg
            })
            return RedirectResponse(url=f"{frontend_base}/email-integration?{params}", status_code=302)

    if not res.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.get("message", "OAuth callback failed.")
        )
    return res


@router.post("/email/oauth/disconnect", dependencies=[Depends(require_admin_when_authenticated)])
def disconnect_gmail():
    """Disconnects the OAuth mailbox, revokes/clears stored tokens, and sets status to Not Connected in MongoDB."""
    return disconnect_gmail_oauth()


# ============================================================
# 3. EMAIL SAFETY & FILTERING RULES
# ============================================================
@router.get("/email/filters", dependencies=[Depends(require_admin_when_authenticated)])
def get_email_filters():
    """Returns the active email safety & filtering rules."""
    return {
        "success": True,
        "data": get_email_filter_rules()
    }


@router.patch("/email/filters", dependencies=[Depends(require_admin_when_authenticated)])
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
@router.get("/email/settings", dependencies=[Depends(require_admin_when_authenticated)])
def get_email_configuration():
    """Returns email integration settings, OAuth connection state, and filter rules. Passwords/tokens are never returned."""
    return {
        "success": True,
        "data": get_email_settings()
    }


@router.patch("/email/settings", dependencies=[Depends(require_admin_when_authenticated)])
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


@router.post("/email/test-connection", dependencies=[Depends(require_admin_when_authenticated)])
def run_test_connection(req: TestConnectionRequest = Body(default=TestConnectionRequest())):
    """Tests active Gmail OAuth connection status."""
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
@router.get("/email/recent", dependencies=[Depends(require_admin_when_authenticated)])
def list_recent_emails(
    limit: int = Query(25, ge=1, le=100),
    include_demo: bool = Query(False, description="Include Development / Test Only demo email records")
):
    """
    Returns recent ingested emails with traceability metadata:
    gmail_message_id, message_id, sender, recipient, subject, received_time, attachments,
    processing_status, verification result, asset_id, source, and is_demo.
    """
    events = get_recent_ingested_emails(limit=limit, include_demo=include_demo)

    asset_filter: Dict[str, Any] = {
        "$or": [
            {"email_metadata": {"$exists": True, "$ne": None}},
            {"source": {"$regex": "Email Ingestion|Gmail", "$options": "i"}}
        ]
    }
    if not include_demo:
        asset_filter["$and"] = [
            {"is_demo": {"$ne": True}},
            {"email_metadata.is_demo": {"$ne": True}},
            {"email_metadata.simulated": {"$ne": True}},
            {"email_metadata.ingestion_mode": {"$ne": "DEMO"}}
        ]

    db_email_assets = list(
        get_assets_collection().find(
            asset_filter,
            {"_id": 0}
        ).sort("created_at", -1).limit(limit)
    )

    return {
        "success": True,
        "data": {
            "count": len(events),
            "recent_emails": events,
            "database_assets": db_email_assets
        }
    }


# ============================================================
# 6. REAL GMAIL SYNCHRONIZATION & DEMO EMAIL INGESTION
# ============================================================
@router.post("/email/sync", dependencies=[Depends(require_admin_when_authenticated)])
@router.post("/email/poll", dependencies=[Depends(require_admin_when_authenticated)])
def trigger_email_sync(department: Optional[str] = Query("Operations")):
    """
    Synchronizes real incoming Gmail messages using stored Google OAuth 2.0 credentials,
    prevents duplicates by Gmail Message ID, and processes messages + attachments through
    the 7-layer verification pipeline + Groq AI.
    """
    res = sync_gmail_messages(department=department or "Operations")
    return {
        "success": res.get("success", False),
        "data": res,
        "message": res.get("message", "Gmail synchronization completed.")
    }


@router.post("/email/demo", dependencies=[Depends(require_admin_when_authenticated)])
@router.post("/email/simulate", dependencies=[Depends(require_admin_when_authenticated)])
async def demo_email_ingestion(
    file: Optional[UploadFile] = File(None),
    sender: str = Form("partner@external-corp.com"),
    subject: str = Form("Quarterly Confidential Security Audit Report"),
    body_text: Optional[str] = Form("Please find attached the security compliance review and audit logs for your team's immediate evaluation."),
    department: str = Form("Operations"),
    message_id: Optional[str] = Form(None)
):
    """
    Clearly labelled Development / Test Only DEMO EMAIL INGESTION mode.
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
        "message": f"[DEV / TEST DEMO] Email ingested and verified. Generated {len(result.get('created_assets', []))} digital asset(s)."
    }


# ============================================================
# 7. WATCHED FOLDER & AUDIT HISTORY
# ============================================================
@router.post("/scan", dependencies=[Depends(require_admin_when_authenticated)])
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


@router.get("/history", dependencies=[Depends(require_admin_when_authenticated)])
def get_ingestion_history(limit: int = Query(25, ge=1, le=100)):
    """Retrieves ingestion audit history and event telemetry from MongoDB."""
    logs_cursor = get_audit_logs_collection().find(
        {
            "action": {
                "$in": [
                    "ASSET_INGESTED",
                    "EMAIL_INGESTED",
                    "ATTACHMENT_PROCESSED",
                    "GMAIL_SYNC_STARTED",
                    "GMAIL_SYNC_COMPLETED",
                    "DUPLICATE_ASSET_SKIPPED",
                    "INGESTION_FAILED",
                    "ASSET_VERIFIED",
                    "EMAIL_OAUTH_INITIATED",
                    "EMAIL_OAUTH_CONNECTED",
                    "EMAIL_OAUTH_FAILED",
                    "EMAIL_OAUTH_TOKEN_REFRESH_FAILED",
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
