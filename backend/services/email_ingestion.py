import os
import io
import time
import email
import imaplib
import hashlib
import secrets
import base64
import logging
import tempfile
import datetime
import uuid
import re
import urllib.parse
from email.header import decode_header
from email.utils import parsedate_to_datetime
from typing import Dict, Any, List, Optional, Tuple
import asyncio
import httpx
from dotenv import load_dotenv, dotenv_values

from database import get_email_integrations_collection, get_assets_collection
from services.verification_pipeline import run_7layer_verification_pipeline
from utils.file_validator import validate_file, ALLOWED_EXTENSIONS
from utils.audit import record_audit_log

logger = logging.getLogger("trustsphere.email_ingestion")

DEFAULT_ORG_ID = "ORG-TRUSTSPHERE"
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Google OAuth 2.0 & Gmail API Endpoints (Minimum read-only scope)
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"
GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly openid email"

DEFAULT_FILTER_RULES = {
    "allowed_senders": [],
    "subject_keywords": [],
    "require_attachment": False,
    "allowed_extensions": [".pdf", ".docx", ".xlsx", ".png", ".jpg", ".jpeg", ".txt"],
    "max_file_size_mb": 10
}

# ============================================================
# RUNTIME CONFIGURATION (INITIALIZED FROM ENVIRONMENT)
# ============================================================
# Note: admin@trustsphere.com is NOT automatically the monitored mailbox.

_runtime_config = {
    "enabled": os.environ.get("EMAIL_INGESTION_ENABLED", "false").lower() in ("true", "1", "yes"),
    "server": os.environ.get("IMAP_SERVER", "imap.gmail.com"),
    "port": int(os.environ.get("IMAP_PORT", 993)),
    "username": os.environ.get("IMAP_USERNAME", ""),
    "folder": os.environ.get("IMAP_FOLDER", "INBOX"),
    "analysis_mode": os.environ.get("EMAIL_ANALYSIS_MODE", "both"),  # "both" | "attachments" | "body"
    "poll_interval": int(os.environ.get("EMAIL_POLL_INTERVAL_SECONDS", os.environ.get("EMAIL_POLL_INTERVAL", 60))),
    "use_ssl": True
}

# In-memory Telemetry State & Ingestion Event Journal
email_state = {
    "last_poll_time": None,
    "last_poll_status": "Idle / Ready",
    "total_emails_checked": 0,
    "total_attachments_processed": 0,
    "total_bodies_processed": 0,
    "total_rejected": 0,
    "total_errors": 0,
    "recent_events": []  # List of ingested email event dicts
}


def _reload_env() -> None:
    """Reloads backend/.env so credential updates are detected immediately without erasing non-empty OS env vars."""
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(env_path):
        vals = dotenv_values(env_path)
        for k, v in vals.items():
            if v is not None and (str(v).strip() != "" or k not in os.environ):
                os.environ[k] = str(v)


def decode_str(header_value: Any) -> str:
    """Safely decodes RFC 2047 MIME encoded headers."""
    if not header_value:
        return ""
    try:
        decoded_parts = decode_header(header_value)
        text_parts = []
        for part, encoding in decoded_parts:
            if isinstance(part, bytes):
                text_parts.append(part.decode(encoding or "utf-8", errors="replace"))
            else:
                text_parts.append(str(part))
        return "".join(text_parts).strip()
    except Exception:
        return str(header_value).strip()


# ============================================================
# MONGODB EMAIL_INTEGRATIONS & OAUTH MANAGEMENT
# ============================================================

def _ensure_integration_record(organization_id: str = DEFAULT_ORG_ID) -> Dict[str, Any]:
    """
    Ensures a mailbox connection record exists in the `email_integrations` MongoDB collection.
    Note: admin@trustsphere.com is NOT automatically connected as a monitored mailbox.
    """
    col = get_email_integrations_collection()
    doc = col.find_one({"organization_id": organization_id, "provider": "gmail"})
    now_iso = datetime.datetime.utcnow().isoformat()
    if not doc:
        doc = {
            "organization_id": organization_id,
            "provider": "gmail",
            "email_address": None,
            "status": "Not Connected",
            "oauth_reference": None,
            "last_sync_at": None,
            "filter_rules": dict(DEFAULT_FILTER_RULES),
            "created_at": now_iso,
            "updated_at": now_iso
        }
        res = col.insert_one(doc)
        doc["_id"] = str(res.inserted_id)
    else:
        doc["_id"] = str(doc["_id"])
        if "filter_rules" not in doc or not isinstance(doc["filter_rules"], dict):
            doc["filter_rules"] = dict(DEFAULT_FILTER_RULES)
            col.update_one(
                {"organization_id": organization_id, "provider": "gmail"},
                {"$set": {"filter_rules": doc["filter_rules"], "updated_at": now_iso}}
            )
    return doc


def get_google_oauth_config() -> Tuple[str, str, str]:
    """Returns (client_id, client_secret, redirect_uri) from environment."""
    _reload_env()
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
    redirect_uri = os.environ.get(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:8000/api/ingestion/email/oauth/callback"
    ).strip()
    return client_id, client_secret, redirect_uri


def is_google_oauth_configured() -> bool:
    """Checks if real Google OAuth credentials are set in backend/.env."""
    client_id, client_secret, _ = get_google_oauth_config()
    if not client_id or not client_secret:
        return False
    placeholders = ("your_", "replace_", "<", "example")
    if any(client_id.lower().startswith(p) for p in placeholders):
        return False
    if any(client_secret.lower().startswith(p) for p in placeholders):
        return False
    return True


def _has_valid_stored_tokens(doc: Dict[str, Any]) -> bool:
    """Checks whether the MongoDB integration record holds real OAuth tokens."""
    tokens = doc.get("oauth_tokens")
    if not isinstance(tokens, dict):
        return False
    return bool(tokens.get("access_token") or tokens.get("refresh_token"))


def get_oauth_integration_status(organization_id: str = DEFAULT_ORG_ID) -> Dict[str, Any]:
    """
    Returns the honest OAuth mailbox connection state from `email_integrations`.
    Never pretends a real Gmail mailbox is connected if OAuth credentials or tokens are missing.
    Never exposes client_secret, access_token, or refresh_token to the caller.
    """
    doc = _ensure_integration_record(organization_id)
    oauth_ready = is_google_oauth_configured()
    _, _, redirect_uri = get_google_oauth_config()

    status_val = doc.get("status", "Not Connected")
    has_tokens = _has_valid_stored_tokens(doc)

    # Honest connection enforcement: must have configured OAuth AND real stored tokens AND email address
    if status_val == "Connected" and (not oauth_ready or not has_tokens or not doc.get("email_address")):
        status_val = "Not Connected"

    is_connected = status_val == "Connected"

    return {
        "_id": doc.get("_id"),
        "organization_id": doc.get("organization_id", DEFAULT_ORG_ID),
        "provider": "Gmail",
        "email_address": doc.get("email_address") if is_connected else None,
        "status": "Connected" if is_connected else "Not Connected",
        "is_connected": is_connected,
        "oauth_configured": oauth_ready,
        "oauth_reference": doc.get("oauth_reference") if is_connected else None,
        "redirect_uri": redirect_uri,
        "scope": GMAIL_READONLY_SCOPE,
        "last_sync_at": doc.get("last_sync_at"),
        "filter_rules": doc.get("filter_rules", DEFAULT_FILTER_RULES),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
        "demo_mode_available": True
    }


def initiate_gmail_oauth_connect(organization_id: str = DEFAULT_ORG_ID) -> Dict[str, Any]:
    """
    Initiates real Google OAuth 2.0 flow if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured.
    Generates a cryptographic state token, stores it in MongoDB for callback validation,
    and returns the Google OAuth 2.0 authorization URL requesting gmail.readonly scope.
    """
    _ensure_integration_record(organization_id)
    if not is_google_oauth_configured():
        return {
            "success": False,
            "oauth_configured": False,
            "status": "Not Connected",
            "authorization_url": None,
            "message": (
                "Google OAuth 2.0 credentials (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) are not "
                "configured in backend/.env. Configure your Google Cloud OAuth 2.0 Client ID and Secret "
                "in backend/.env to connect a real Gmail account."
            )
        }

    client_id, _, redirect_uri = get_google_oauth_config()
    state_token = f"ts-oauth-{secrets.token_urlsafe(24)}"
    now_iso = datetime.datetime.utcnow().isoformat()

    # Persist state token in MongoDB to validate callback and prevent CSRF (keep recent states so multi-tab retries succeed)
    col = get_email_integrations_collection()
    existing_doc = col.find_one({"organization_id": organization_id, "provider": "gmail"}) or {}
    recent_states = list(existing_doc.get("pending_oauth_states") or [])
    if existing_doc.get("pending_oauth_state") and existing_doc["pending_oauth_state"] not in recent_states:
        recent_states.append(existing_doc["pending_oauth_state"])
    recent_states = (recent_states + [state_token])[-10:]

    col.update_one(
        {"organization_id": organization_id, "provider": "gmail"},
        {
            "$set": {
                "pending_oauth_state": state_token,
                "pending_oauth_states": recent_states,
                "pending_oauth_state_at": now_iso,
                "updated_at": now_iso
            }
        }
    )

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": GMAIL_READONLY_SCOPE,
        "access_type": "offline",
        "prompt": "consent select_account",
        "include_granted_scopes": "true",
        "state": state_token
    }
    auth_url = f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"

    record_audit_log(
        action="EMAIL_OAUTH_INITIATED",
        entity_type="EMAIL_INTEGRATION",
        entity_id=organization_id,
        user_id="ADMIN",
        description=f"Initiated Google OAuth 2.0 authorization flow (Redirect URI: {redirect_uri})."
    )

    return {
        "success": True,
        "oauth_configured": True,
        "status": "Pending Authorization",
        "authorization_url": auth_url,
        "redirect_uri": redirect_uri,
        "state": state_token,
        "message": "Redirecting to Google OAuth 2.0 consent screen."
    }


def complete_gmail_oauth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    organization_id: str = DEFAULT_ORG_ID
) -> Dict[str, Any]:
    """
    Completes the real Google OAuth 2.0 callback:
    1. Handles user denial / error returned by Google.
    2. Verifies GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET are configured.
    3. Validates the `state` token against the stored pending state in MongoDB.
    4. Exchanges the authorization `code` for access & refresh tokens via https://oauth2.googleapis.com/token.
    5. Queries the authenticated user's real Gmail address via Gmail API / Google UserInfo API.
    6. Stores tokens securely on the backend in MongoDB and marks status as Connected.
    """
    doc = _ensure_integration_record(organization_id)
    col = get_email_integrations_collection()
    now_utc = datetime.datetime.utcnow()
    now_iso = now_utc.isoformat()

    # 1. Handle user denial or OAuth error from Google
    if error:
        err_msg = error_description or (
            "Google OAuth authorization was denied or cancelled by the user."
            if error == "access_denied"
            else f"Google OAuth error: {error}"
        )
        col.update_one(
            {"organization_id": organization_id, "provider": "gmail"},
            {"$set": {"pending_oauth_state": None, "updated_at": now_iso}}
        )
        record_audit_log(
            action="EMAIL_OAUTH_FAILED",
            entity_type="EMAIL_INTEGRATION",
            entity_id=organization_id,
            user_id="ADMIN",
            description=f"Google OAuth callback failed ({error}): {err_msg}",
            result="WARNING"
        )
        return {
            "success": False,
            "error_code": error,
            "message": err_msg
        }

    # 2. Verify OAuth credentials exist in backend/.env
    if not is_google_oauth_configured():
        return {
            "success": False,
            "error_code": "missing_credentials",
            "message": "Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) are not configured in backend/.env."
        }

    # 3. Validate OAuth state parameter to protect authorization flow
    expected_state = doc.get("pending_oauth_state")
    allowed_states = set(doc.get("pending_oauth_states") or [])
    if expected_state:
        allowed_states.add(str(expected_state))

    state_matched = bool(state and any(secrets.compare_digest(str(state), s) for s in allowed_states))
    if not state_matched:
        record_audit_log(
            action="EMAIL_OAUTH_FAILED",
            entity_type="EMAIL_INTEGRATION",
            entity_id=organization_id,
            user_id="ADMIN",
            description="OAuth callback rejected due to invalid or mismatched state parameter.",
            result="WARNING"
        )
        return {
            "success": False,
            "error_code": "invalid_state",
            "message": "Invalid or expired OAuth state token. Please click 'Connect Gmail' and try again."
        }

    # Check state expiration (60 minutes max)
    state_at_str = doc.get("pending_oauth_state_at")
    if state_at_str:
        try:
            state_at = datetime.datetime.fromisoformat(state_at_str)
            if (now_utc - state_at).total_seconds() > 3600:
                return {
                    "success": False,
                    "error_code": "expired_state",
                    "message": "OAuth authorization session expired. Please click 'Connect Gmail' and try again."
                }
        except Exception:
            pass

    # 4. Validate authorization code presence
    if not code or len(code.strip()) < 4:
        return {
            "success": False,
            "error_code": "invalid_code",
            "message": "Missing or invalid Google OAuth authorization code."
        }

    client_id, client_secret, redirect_uri = get_google_oauth_config()

    # 5. Exchange authorization code for tokens with Google OAuth 2.0 server
    try:
        with httpx.Client(timeout=15.0) as client:
            token_resp = client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code.strip(),
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code"
                },
                headers={"Accept": "application/json"}
            )
    except httpx.RequestError as exc:
        logger.error(f"Network error during Google OAuth token exchange: {exc}")
        record_audit_log(
            action="EMAIL_OAUTH_FAILED",
            entity_type="EMAIL_INTEGRATION",
            entity_id=organization_id,
            user_id="ADMIN",
            description=f"Network error during Google OAuth token exchange: {str(exc)}",
            result="WARNING"
        )
        return {
            "success": False,
            "error_code": "network_error",
            "message": f"Network error communicating with Google OAuth server: {str(exc)}"
        }

    try:
        token_data = token_resp.json()
    except Exception:
        token_data = {}

    if token_resp.status_code != 200 or "access_token" not in token_data:
        g_err = token_data.get("error", "token_exchange_failed")
        g_desc = token_data.get("error_description", "Could not exchange authorization code for tokens.")
        if g_err == "invalid_grant":
            friendly_msg = "Authorization code is invalid or has expired. Please click 'Connect Gmail' to start a fresh authorization."
        elif g_err == "redirect_uri_mismatch":
            friendly_msg = f"Redirect URI mismatch. Ensure '{redirect_uri}' is added to Authorized redirect URIs in Google Cloud Console."
        elif g_err == "invalid_client":
            friendly_msg = "Invalid GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in backend/.env."
        else:
            friendly_msg = f"Google OAuth token exchange failed ({g_err}): {g_desc}"

        record_audit_log(
            action="EMAIL_OAUTH_FAILED",
            entity_type="EMAIL_INTEGRATION",
            entity_id=organization_id,
            user_id="ADMIN",
            description=friendly_msg,
            result="WARNING"
        )
        return {
            "success": False,
            "error_code": g_err,
            "message": friendly_msg
        }

    access_token = token_data["access_token"]
    refresh_token = token_data.get("refresh_token") or (doc.get("oauth_tokens") or {}).get("refresh_token")
    expires_in = int(token_data.get("expires_in", 3599))
    expires_at = (now_utc + datetime.timedelta(seconds=expires_in)).isoformat()
    granted_scope = token_data.get("scope", GMAIL_READONLY_SCOPE)

    # 6. Identify the connected Gmail account from Google APIs
    connected_email = None
    try:
        with httpx.Client(timeout=15.0) as client:
            prof_resp = client.get(
                f"{GMAIL_API_BASE}/profile",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if prof_resp.status_code == 200:
                connected_email = prof_resp.json().get("emailAddress")

            if not connected_email:
                ui_resp = client.get(
                    GOOGLE_USERINFO_URL,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                if ui_resp.status_code == 200:
                    connected_email = ui_resp.json().get("email")
    except httpx.RequestError as exc:
        logger.error(f"Failed to query Gmail profile after token exchange: {exc}")
        return {
            "success": False,
            "error_code": "profile_fetch_network_error",
            "message": f"Obtained OAuth token, but failed to verify Gmail profile due to network error: {str(exc)}"
        }

    if not connected_email:
        record_audit_log(
            action="EMAIL_OAUTH_FAILED",
            entity_type="EMAIL_INTEGRATION",
            entity_id=organization_id,
            user_id="ADMIN",
            description="OAuth token obtained, but Gmail API profile lookup failed. Ensure Gmail API is enabled in Google Cloud Console.",
            result="WARNING"
        )
        return {
            "success": False,
            "error_code": "gmail_profile_unavailable",
            "message": "Could not retrieve Gmail address from Google. Please ensure the Gmail API is enabled in your Google Cloud Console project."
        }

    # 7. Store OAuth tokens securely on the backend (never exposed to frontend)
    oauth_ref = f"oauth2_ref_{hashlib.sha256( f'{connected_email}:{now_iso}'.encode('utf-8') ).hexdigest()[:20]}"
    stored_tokens = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": token_data.get("token_type", "Bearer"),
        "scope": granted_scope,
        "expires_at": expires_at,
        "obtained_at": now_iso
    }

    col.update_one(
        {"organization_id": organization_id, "provider": "gmail"},
        {
            "$set": {
                "email_address": connected_email,
                "status": "Connected",
                "oauth_reference": oauth_ref,
                "oauth_tokens": stored_tokens,
                "pending_oauth_state": None,
                "pending_oauth_state_at": None,
                "updated_at": now_iso
            }
        },
        upsert=True
    )
    _runtime_config["enabled"] = True

    record_audit_log(
        action="EMAIL_OAUTH_CONNECTED",
        entity_type="EMAIL_INTEGRATION",
        entity_id=organization_id,
        user_id="ADMIN",
        description=f"Gmail connected via Google OAuth 2.0: {connected_email} (Ref: {oauth_ref})."
    )

    return {
        "success": True,
        "data": get_oauth_integration_status(organization_id),
        "message": f"Gmail mailbox '{connected_email}' connected via Google OAuth 2.0."
    }


def _get_valid_gmail_access_token(organization_id: str = DEFAULT_ORG_ID) -> Tuple[Optional[str], Optional[str]]:
    """
    Retrieves a valid Google OAuth 2.0 access_token for the connected Gmail account.
    Automatically refreshes the access_token using the stored refresh_token if expired.
    Returns (access_token, error_message).
    """
    doc = _ensure_integration_record(organization_id)
    if doc.get("status") != "Connected" or not _has_valid_stored_tokens(doc):
        return None, "Gmail account is not connected. Please click 'Connect Gmail' and complete Google OAuth authorization."

    if not is_google_oauth_configured():
        return None, "Google OAuth credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) are missing in backend/.env."

    tokens = doc.get("oauth_tokens") or {}
    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    expires_at_str = tokens.get("expires_at")

    now_utc = datetime.datetime.utcnow()
    needs_refresh = False

    if not access_token:
        needs_refresh = True
    elif expires_at_str:
        try:
            expires_at = datetime.datetime.fromisoformat(expires_at_str)
            if (expires_at - now_utc).total_seconds() < 60:
                needs_refresh = True
        except Exception:
            needs_refresh = True

    if not needs_refresh:
        return access_token, None

    if not refresh_token:
        # Mark disconnected if expired and no refresh token is available
        col = get_email_integrations_collection()
        col.update_one(
            {"organization_id": organization_id, "provider": "gmail"},
            {"$set": {"status": "Not Connected", "oauth_tokens": None, "updated_at": now_utc.isoformat()}}
        )
        record_audit_log(
            action="EMAIL_OAUTH_TOKEN_REFRESH_FAILED",
            entity_type="EMAIL_INTEGRATION",
            entity_id=organization_id,
            user_id="SYSTEM",
            description="OAuth access token expired and no refresh token was available. Re-authorization required.",
            result="WARNING"
        )
        return None, "Gmail OAuth session expired and no refresh token is available. Please click 'Connect Gmail' to re-authorize."

    client_id, client_secret, _ = get_google_oauth_config()
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token"
                },
                headers={"Accept": "application/json"}
            )
    except httpx.RequestError as exc:
        return None, f"Network error while refreshing Gmail OAuth token: {str(exc)}"

    try:
        refresh_data = resp.json()
    except Exception:
        refresh_data = {}

    if resp.status_code != 200 or "access_token" not in refresh_data:
        err_desc = refresh_data.get("error_description") or refresh_data.get("error") or "Token refresh rejected by Google."
        col = get_email_integrations_collection()
        col.update_one(
            {"organization_id": organization_id, "provider": "gmail"},
            {
                "$set": {
                    "status": "Not Connected",
                    "email_address": None,
                    "oauth_tokens": None,
                    "oauth_reference": None,
                    "updated_at": now_utc.isoformat()
                }
            }
        )
        record_audit_log(
            action="EMAIL_OAUTH_TOKEN_REFRESH_FAILED",
            entity_type="EMAIL_INTEGRATION",
            entity_id=organization_id,
            user_id="SYSTEM",
            description=f"Gmail OAuth token refresh failed ({err_desc}). Account marked Not Connected.",
            result="WARNING"
        )
        return None, f"Gmail OAuth token refresh failed ({err_desc}). Please reconnect your Gmail account."

    new_access_token = refresh_data["access_token"]
    expires_in = int(refresh_data.get("expires_in", 3599))
    new_expires_at = (now_utc + datetime.timedelta(seconds=expires_in)).isoformat()

    updated_tokens = {
        **tokens,
        "access_token": new_access_token,
        "expires_at": new_expires_at,
        "refreshed_at": now_utc.isoformat()
    }
    if refresh_data.get("refresh_token"):
        updated_tokens["refresh_token"] = refresh_data["refresh_token"]

    col = get_email_integrations_collection()
    col.update_one(
        {"organization_id": organization_id, "provider": "gmail"},
        {"$set": {"oauth_tokens": updated_tokens, "updated_at": now_utc.isoformat()}}
    )
    return new_access_token, None


def disconnect_gmail_oauth(organization_id: str = DEFAULT_ORG_ID) -> Dict[str, Any]:
    """
    Disconnects the Gmail account:
    - Best-effort revokes the OAuth token with Google
    - Securely clears stored OAuth tokens and references in MongoDB
    - Updates status to Not Connected and stops synchronization
    """
    doc = _ensure_integration_record(organization_id)
    prev_email = doc.get("email_address")
    tokens = doc.get("oauth_tokens") or {}
    token_to_revoke = tokens.get("refresh_token") or tokens.get("access_token")

    if token_to_revoke:
        try:
            with httpx.Client(timeout=5.0) as client:
                client.post(GOOGLE_REVOKE_URL, params={"token": token_to_revoke})
        except Exception:
            pass

    now_iso = datetime.datetime.utcnow().isoformat()
    col = get_email_integrations_collection()
    col.update_one(
        {"organization_id": organization_id, "provider": "gmail"},
        {
            "$set": {
                "email_address": None,
                "status": "Not Connected",
                "oauth_reference": None,
                "oauth_tokens": None,
                "pending_oauth_state": None,
                "pending_oauth_state_at": None,
                "last_sync_at": None,
                "updated_at": now_iso
            }
        }
    )
    _runtime_config["enabled"] = False

    record_audit_log(
        action="EMAIL_OAUTH_DISCONNECTED",
        entity_type="EMAIL_INTEGRATION",
        entity_id=organization_id,
        user_id="ADMIN",
        description=f"Disconnected Gmail OAuth integration{f' ({prev_email})' if prev_email else ''} and cleared stored OAuth tokens."
    )

    return {
        "success": True,
        "data": get_oauth_integration_status(organization_id),
        "message": "Gmail account disconnected and OAuth credentials cleared. Status is now Not Connected."
    }


# ============================================================
# EMAIL SAFETY & FILTERING RULES
# ============================================================

def get_email_filter_rules(organization_id: str = DEFAULT_ORG_ID) -> Dict[str, Any]:
    doc = _ensure_integration_record(organization_id)
    rules = doc.get("filter_rules") or dict(DEFAULT_FILTER_RULES)
    return {
        "allowed_senders": rules.get("allowed_senders", []),
        "subject_keywords": rules.get("subject_keywords", []),
        "require_attachment": bool(rules.get("require_attachment", False)),
        "allowed_extensions": rules.get("allowed_extensions", DEFAULT_FILTER_RULES["allowed_extensions"]),
        "max_file_size_mb": int(rules.get("max_file_size_mb", 10))
    }


def update_email_filter_rules(
    new_rules: Dict[str, Any],
    organization_id: str = DEFAULT_ORG_ID
) -> Dict[str, Any]:
    """Updates email safety and filtering rules in MongoDB `email_integrations`."""
    current = get_email_filter_rules(organization_id)

    if "allowed_senders" in new_rules and new_rules["allowed_senders"] is not None:
        raw_senders = new_rules["allowed_senders"]
        if isinstance(raw_senders, str):
            current["allowed_senders"] = [s.strip().lower() for s in raw_senders.split(",") if s.strip()]
        elif isinstance(raw_senders, list):
            current["allowed_senders"] = [str(s).strip().lower() for s in raw_senders if str(s).strip()]

    if "subject_keywords" in new_rules and new_rules["subject_keywords"] is not None:
        raw_kw = new_rules["subject_keywords"]
        if isinstance(raw_kw, str):
            current["subject_keywords"] = [k.strip().lower() for k in raw_kw.split(",") if k.strip()]
        elif isinstance(raw_kw, list):
            current["subject_keywords"] = [str(k).strip().lower() for k in raw_kw if str(k).strip()]

    if "require_attachment" in new_rules and new_rules["require_attachment"] is not None:
        current["require_attachment"] = bool(new_rules["require_attachment"])

    if "allowed_extensions" in new_rules and new_rules["allowed_extensions"] is not None:
        raw_exts = new_rules["allowed_extensions"]
        if isinstance(raw_exts, str):
            exts = [e.strip().lower() for e in raw_exts.split(",") if e.strip()]
        elif isinstance(raw_exts, list):
            exts = [str(e).strip().lower() for e in raw_exts if str(e).strip()]
        else:
            exts = DEFAULT_FILTER_RULES["allowed_extensions"]
        current["allowed_extensions"] = [e if e.startswith(".") else f".{e}" for e in exts]

    if "max_file_size_mb" in new_rules and new_rules["max_file_size_mb"] is not None:
        current["max_file_size_mb"] = max(1, min(50, int(new_rules["max_file_size_mb"])))

    now_iso = datetime.datetime.utcnow().isoformat()
    col = get_email_integrations_collection()
    col.update_one(
        {"organization_id": organization_id, "provider": "gmail"},
        {"$set": {"filter_rules": current, "updated_at": now_iso}}
    )

    record_audit_log(
        action="EMAIL_FILTER_RULES_UPDATED",
        entity_type="EMAIL_INTEGRATION",
        entity_id=organization_id,
        user_id="ADMIN",
        description=f"Updated email safety & filtering rules: require_attachment={current['require_attachment']}, max_size={current['max_file_size_mb']}MB."
    )

    return current


def is_email_message_already_processed(
    message_id: Optional[str] = None,
    gmail_message_id: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Checks MongoDB `assets` collection to see if a Gmail or RFC Message-ID has already been ingested."""
    or_clauses = []
    if gmail_message_id:
        or_clauses.append({"email_metadata.gmail_message_id": gmail_message_id})
        or_clauses.append({"email_metadata.message_id": gmail_message_id})
    if message_id:
        or_clauses.append({"email_metadata.message_id": message_id})

    if not or_clauses:
        return None

    return get_assets_collection().find_one(
        {"$or": or_clauses},
        {"asset_id": 1, "filename": 1, "_id": 0}
    )


def evaluate_email_safety_and_filters(
    sender: str,
    subject: str,
    filename: Optional[str] = None,
    file_size_bytes: Optional[int] = None,
    message_id: Optional[str] = None,
    gmail_message_id: Optional[str] = None,
    organization_id: str = DEFAULT_ORG_ID
) -> Dict[str, Any]:
    """
    Validates an incoming email against:
    1. Duplicate message_id / gmail_message_id check in MongoDB
    2. Allowed sender filter (if configured)
    3. Subject keyword filter (if configured)
    4. Attachment presence requirement (if configured)
    5. Attachment extension & file-size validation
    """
    rules = get_email_filter_rules(organization_id)

    # 1. Duplicate message_id / gmail_message_id check
    existing_in_db = is_email_message_already_processed(message_id=message_id, gmail_message_id=gmail_message_id)
    if existing_in_db:
        dup_id = gmail_message_id or message_id
        return {
            "allowed": False,
            "is_duplicate_message": True,
            "reason": f"Duplicate email Message-ID '{dup_id}' already processed as asset {existing_in_db.get('asset_id')}.",
            "existing_asset_id": existing_in_db.get("asset_id")
        }

    # 2. Sender filter
    allowed_senders = rules.get("allowed_senders", [])
    if allowed_senders:
        sender_lower = (sender or "").lower()
        if not any(pat in sender_lower for pat in allowed_senders):
            return {
                "allowed": False,
                "is_duplicate_message": False,
                "reason": f"Sender '{sender}' does not match configured allowed senders ({', '.join(allowed_senders)})."
            }

    # 3. Subject keywords filter
    subject_keywords = rules.get("subject_keywords", [])
    if subject_keywords:
        subj_lower = (subject or "").lower()
        if not any(kw in subj_lower for kw in subject_keywords):
            return {
                "allowed": False,
                "is_duplicate_message": False,
                "reason": f"Subject '{subject}' does not contain any required keywords ({', '.join(subject_keywords)})."
            }

    # 4. Attachment presence filter
    if rules.get("require_attachment") and not filename:
        return {
            "allowed": False,
            "is_duplicate_message": False,
            "reason": "Email rejected: Policy requires an attachment, but no attachment was present."
        }

    # 5. Attachment file extension & size validation
    if filename:
        ext = os.path.splitext(filename)[1].lower()
        allowed_exts = rules.get("allowed_extensions", DEFAULT_FILTER_RULES["allowed_extensions"])
        if ext not in allowed_exts or ext not in ALLOWED_EXTENSIONS:
            return {
                "allowed": False,
                "is_duplicate_message": False,
                "reason": f"Unsupported or unsafe attachment file type '{ext}' in '{filename}'. Allowed types: {', '.join(allowed_exts)}."
            }

        max_bytes = int(rules.get("max_file_size_mb", 10)) * 1024 * 1024
        if file_size_bytes is not None and file_size_bytes > max_bytes:
            return {
                "allowed": False,
                "is_duplicate_message": False,
                "reason": f"Attachment '{filename}' exceeds maximum allowed size of {rules.get('max_file_size_mb', 10)} MB."
            }

        std_validation = validate_file(filename, file_size_bytes)
        if not std_validation.get("valid"):
            return {
                "allowed": False,
                "is_duplicate_message": False,
                "reason": std_validation.get("message", "File validation failed.")
            }

    return {
        "allowed": True,
        "is_duplicate_message": False,
        "reason": "Email passed all safety and filtering rules."
    }


# ============================================================
# EMAIL SETTINGS & STATUS
# ============================================================

def get_email_settings() -> Dict[str, Any]:
    """
    Returns current configuration settings, OAuth connection state, and filter rules.
    Never exposes passwords or raw OAuth secrets.
    """
    oauth_info = get_oauth_integration_status()
    return {
        "enabled": _runtime_config["enabled"],
        "server": _runtime_config["server"],
        "port": _runtime_config["port"],
        "username": oauth_info.get("email_address") or "Not Connected",
        "folder": _runtime_config["folder"],
        "analysis_mode": _runtime_config["analysis_mode"],
        "poll_interval": _runtime_config["poll_interval"],
        "use_ssl": _runtime_config["use_ssl"],
        "is_configured": bool(oauth_info.get("is_connected")),
        "has_credentials": bool(oauth_info.get("is_connected")),
        "oauth": oauth_info,
        "filter_rules": oauth_info.get("filter_rules", DEFAULT_FILTER_RULES)
    }


def update_email_settings(new_settings: Dict[str, Any]) -> Dict[str, Any]:
    """
    Updates non-secret runtime configuration and optional filter rules.
    Refuses to accept or store passwords into persistent storage.
    """
    if "enabled" in new_settings:
        _runtime_config["enabled"] = bool(new_settings["enabled"])
    if "folder" in new_settings and new_settings["folder"]:
        _runtime_config["folder"] = str(new_settings["folder"]).strip()
    if "analysis_mode" in new_settings and new_settings["analysis_mode"]:
        mode = str(new_settings["analysis_mode"]).strip().lower()
        if mode in ("both", "attachments", "body"):
            _runtime_config["analysis_mode"] = mode
    if "poll_interval" in new_settings and new_settings["poll_interval"]:
        _runtime_config["poll_interval"] = max(10, int(new_settings["poll_interval"]))

    if "filter_rules" in new_settings and isinstance(new_settings["filter_rules"], dict):
        update_email_filter_rules(new_settings["filter_rules"])

    record_audit_log(
        action="EMAIL_SETTINGS_UPDATED",
        entity_type="SYSTEM",
        entity_id="EMAIL_INGESTION",
        user_id="ADMIN",
        description=f"Email ingestion configuration updated: enabled={_runtime_config['enabled']}, mode={_runtime_config['analysis_mode']}."
    )

    return get_email_settings()


def test_email_connection(
    server: Optional[str] = None,
    port: Optional[int] = None,
    username: Optional[str] = None,
    password: Optional[str] = None
) -> Dict[str, Any]:
    """Tests active Google OAuth 2.0 Gmail API connection."""
    oauth_status = get_oauth_integration_status()
    if not oauth_status.get("is_connected"):
        return {
            "success": False,
            "message": "Gmail is not connected. Click 'Connect Gmail' to authorize via Google OAuth 2.0."
        }

    access_token, err = _get_valid_gmail_access_token()
    if not access_token:
        return {
            "success": False,
            "message": err or "Could not validate Gmail OAuth access token."
        }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                f"{GMAIL_API_BASE}/profile",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if resp.status_code == 200:
                prof = resp.json()
                return {
                    "success": True,
                    "message": f"Connected to Gmail ({prof.get('emailAddress')}) via Google OAuth 2.0.",
                    "provider": "Gmail",
                    "username": prof.get("emailAddress"),
                    "messages_total": prof.get("messagesTotal")
                }
            return {
                "success": False,
                "message": f"Gmail API returned HTTP {resp.status_code}."
            }
    except Exception as exc:
        return {
            "success": False,
            "message": f"Connection error communicating with Gmail API: {str(exc)}"
        }


def get_email_ingestion_status() -> Dict[str, Any]:
    """Returns the current operational status, OAuth state, filter rules, and telemetry."""
    settings = get_email_settings()
    return {
        **settings,
        "last_poll_time": email_state["last_poll_time"],
        "last_poll_status": email_state["last_poll_status"],
        "total_emails_checked": email_state["total_emails_checked"],
        "total_attachments_processed": email_state["total_attachments_processed"],
        "total_bodies_processed": email_state["total_bodies_processed"],
        "total_rejected": email_state["total_rejected"],
        "total_errors": email_state["total_errors"],
        "recent_events_count": len(get_recent_ingested_emails(limit=50))
    }


def get_recent_ingested_emails(limit: int = 25, include_demo: bool = False) -> List[Dict[str, Any]]:
    """
    Returns recent ingested emails with full traceability from MongoDB `assets` (`email_metadata`)
    merged with in-memory events, ordered newest first and deduplicated by message_id.
    """
    seen_keys = set()
    combined: List[Dict[str, Any]] = []

    # 1. Query MongoDB `assets` collection for persisted email-ingested assets
    try:
        mongo_query: Dict[str, Any] = {
            "$or": [
                {"email_metadata": {"$exists": True, "$ne": None}},
                {"source": {"$regex": "Email Ingestion|Gmail", "$options": "i"}}
            ]
        }
        if not include_demo:
            mongo_query["$and"] = [
                {"is_demo": {"$ne": True}},
                {"email_metadata.is_demo": {"$ne": True}},
                {"email_metadata.simulated": {"$ne": True}},
                {"ingestion_mode": {"$ne": "DEMO"}},
                {"email_metadata.ingestion_mode": {"$ne": "DEMO"}},
                {"source": {"$not": {"$regex": "DEV/TEST DEMO|Simulated", "$options": "i"}}}
            ]
        db_assets = list(
            get_assets_collection().find(mongo_query).sort("created_at", -1).limit(limit * 2)
        )
    except Exception:
        db_assets = []

    for asset in db_assets:
        meta = asset.get("email_metadata") or {}
        is_demo = bool(
            asset.get("is_demo")
            or meta.get("is_demo")
            or meta.get("simulated")
            or asset.get("ingestion_mode") == "DEMO"
            or meta.get("ingestion_mode") == "DEMO"
        )
        if not include_demo and is_demo:
            continue

        gmail_id = meta.get("gmail_message_id")
        msg_id = meta.get("message_id") or gmail_id or asset.get("asset_id")
        dedup_key = gmail_id or msg_id
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)

        att_list = meta.get("attachment_filenames") or (
            [meta["attachment_filename"]] if meta.get("attachment_filename") else (
                [asset.get("filename")] if meta.get("source_type") == "email_attachment" and asset.get("filename") else []
            )
        )
        has_att = bool(att_list or meta.get("has_attachment") or (meta.get("attachment_count", 0) > 0))
        ai_ins = asset.get("ai_insights") or {}

        combined.append({
            "email_id": gmail_id or msg_id,
            "gmail_message_id": gmail_id,
            "message_id": msg_id,
            "sender": meta.get("sender") or "Unknown Sender",
            "recipient": meta.get("recipient") or meta.get("connected_email") or "",
            "subject": meta.get("subject") or asset.get("filename") or "Email Message",
            "received_time": meta.get("received_time") or asset.get("upload_date") or asset.get("created_at"),
            "department": asset.get("department_id") or meta.get("department") or "Operations",
            "provider": "Development / Test Only" if is_demo else (meta.get("provider") or "Gmail"),
            "source": "Development / Test Only" if is_demo else "Gmail",
            "attachments": att_list,
            "has_attachment": has_att,
            "attachment_status": f"{len(att_list)} Attachment(s)" if att_list else ("Attachment Processed" if has_att else "No Attachment (Body Verified)"),
            "processing_status": meta.get("processing_status") or "PROCESSED",
            "status": asset.get("status", "VERIFIED"),
            "trust_score": asset.get("trust_score", 50.0),
            "risk_level": asset.get("risk_level", "Medium Risk"),
            "incident_id": asset.get("incident_id"),
            "ai_summary": asset.get("ai_summary") or ai_ins.get("summary") or ai_ins.get("security_summary"),
            "asset_id": asset.get("asset_id"),
            "assets": meta.get("related_asset_ids") or [asset.get("asset_id")],
            "is_demo": is_demo,
            "simulated": is_demo,
            "ingestion_mode": "DEMO" if is_demo else "REAL",
            "timestamp": asset.get("created_at") or meta.get("received_time")
        })

    # 2. Merge any in-memory events not yet in `seen_keys`
    for ev in email_state["recent_events"]:
        is_demo = bool(ev.get("is_demo") or ev.get("simulated") or ev.get("ingestion_mode") == "DEMO")
        if not include_demo and is_demo:
            continue
        key = ev.get("gmail_message_id") or ev.get("message_id") or ev.get("email_id")
        if key and key not in seen_keys:
            seen_keys.add(key)
            combined.append(ev)

    return combined[:limit]


# ============================================================
# REAL GMAIL REST API MESSAGE PARSING & SYNCHRONIZATION
# ============================================================

def _decode_base64url(data_str: str) -> bytes:
    if not data_str:
        return b""
    pad = "=" * ((4 - len(data_str) % 4) % 4)
    return base64.urlsafe_b64decode(data_str + pad)


def _strip_html_tags(html_text: str) -> str:
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html_text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _extract_gmail_parts(
    payload: Dict[str, Any],
    plain_parts: List[str],
    html_parts: List[str],
    attachments_meta: List[Dict[str, Any]]
) -> None:
    """Recursively traverses a Gmail API message payload to extract body text and attachment descriptors."""
    if not isinstance(payload, dict):
        return

    mime_type = (payload.get("mimeType") or "").lower()
    filename = (payload.get("filename") or "").strip()
    body = payload.get("body") or {}
    subparts = payload.get("parts") or []

    if filename:
        attachments_meta.append({
            "filename": filename,
            "mime_type": mime_type,
            "size": int(body.get("size") or 0),
            "attachment_id": body.get("attachmentId"),
            "inline_data": body.get("data")
        })
    else:
        data_b64 = body.get("data")
        if data_b64:
            raw_bytes = _decode_base64url(data_b64)
            decoded_text = raw_bytes.decode("utf-8", errors="replace").strip()
            if mime_type == "text/plain" and decoded_text:
                plain_parts.append(decoded_text)
            elif mime_type == "text/html" and decoded_text:
                html_parts.append(decoded_text)

    for part in subparts:
        _extract_gmail_parts(part, plain_parts, html_parts, attachments_meta)


def sync_gmail_messages(
    department: str = "Operations",
    max_results: int = 15,
    organization_id: str = DEFAULT_ORG_ID
) -> Dict[str, Any]:
    """
    Synchronizes real incoming Gmail messages using the stored Google OAuth 2.0 credentials:
    1. Authenticates with Gmail API (automatically refreshing expired access token).
    2. Lists messages in INBOX (`GET /gmail/v1/users/me/messages`).
    3. Skips any message whose Gmail Message ID or RFC Message-ID has already been processed.
    4. Downloads new messages and any supported attachments.
    5. Processes attachments and message bodies through the 7-layer verification + Groq AI pipeline.
    6. Updates `last_sync_at` in MongoDB and records comprehensive audit logs.
    """
    record_audit_log(
        action="GMAIL_SYNC_STARTED",
        entity_type="EMAIL_INTEGRATION",
        entity_id=organization_id,
        user_id="ADMIN",
        description=f"Started real Gmail mailbox synchronization (Target Dept: {department})."
    )

    oauth_status = get_oauth_integration_status(organization_id)
    if not oauth_status.get("is_connected"):
        msg = "Gmail is not connected. Please click 'Connect Gmail' and complete Google OAuth 2.0 authorization before synchronizing."
        email_state["last_poll_time"] = datetime.datetime.utcnow().isoformat()
        email_state["last_poll_status"] = "Not Connected"
        return {
            "success": False,
            "status": "not_connected",
            "processed_count": 0,
            "processed_email_count": 0,
            "skipped_duplicates": 0,
            "rejected_count": 0,
            "message": msg
        }

    access_token, token_err = _get_valid_gmail_access_token(organization_id)
    if not access_token:
        email_state["last_poll_time"] = datetime.datetime.utcnow().isoformat()
        email_state["last_poll_status"] = f"Auth Error: {token_err}"
        return {
            "success": False,
            "status": "auth_error",
            "processed_count": 0,
            "processed_email_count": 0,
            "skipped_duplicates": 0,
            "rejected_count": 0,
            "message": token_err or "Failed to obtain valid Gmail OAuth access token."
        }

    connected_email = oauth_status.get("email_address") or ""
    mode = _runtime_config.get("analysis_mode", "both")
    now_iso = datetime.datetime.utcnow().isoformat()
    email_state["last_poll_time"] = now_iso

    processed_assets: List[Dict[str, Any]] = []
    processed_emails_count = 0
    skipped_duplicates = 0
    rejected_count = 0

    try:
        with httpx.Client(timeout=25.0) as client:
            auth_headers = {"Authorization": f"Bearer {access_token}"}

            list_resp = client.get(
                f"{GMAIL_API_BASE}/messages",
                params={"maxResults": max_results, "q": "in:inbox"},
                headers=auth_headers
            )

            if list_resp.status_code != 200:
                err_detail = list_resp.text[:200]
                email_state["total_errors"] += 1
                email_state["last_poll_status"] = f"Gmail API Error ({list_resp.status_code})"
                record_audit_log(
                    action="INGESTION_FAILED",
                    entity_type="EMAIL_INTEGRATION",
                    entity_id=organization_id,
                    user_id="ADMIN",
                    description=f"Gmail API messages list failed with HTTP {list_resp.status_code}: {err_detail}",
                    result="WARNING"
                )
                return {
                    "success": False,
                    "status": "api_error",
                    "processed_count": 0,
                    "processed_email_count": 0,
                    "skipped_duplicates": 0,
                    "rejected_count": 0,
                    "message": f"Gmail API returned HTTP {list_resp.status_code} when listing messages."
                }

            messages_list = list_resp.json().get("messages") or []
            email_state["total_emails_checked"] += len(messages_list)

            # Process oldest-to-newest so newest ends up at top of recent list
            for msg_item in reversed(messages_list):
                gmail_msg_id = msg_item.get("id")
                if not gmail_msg_id:
                    continue

                # Fast duplicate check by Gmail Message ID before fetching payload
                if is_email_message_already_processed(gmail_message_id=gmail_msg_id):
                    skipped_duplicates += 1
                    continue

                msg_resp = client.get(
                    f"{GMAIL_API_BASE}/messages/{gmail_msg_id}",
                    params={"format": "full"},
                    headers=auth_headers
                )
                if msg_resp.status_code != 200:
                    continue

                msg_json = msg_resp.json()
                payload = msg_json.get("payload") or {}
                headers_list = payload.get("headers") or []
                headers_map = {
                    (h.get("name") or "").lower(): h.get("value") or ""
                    for h in headers_list
                }

                subject = decode_str(headers_map.get("subject") or "No Subject")
                sender = decode_str(headers_map.get("from") or "Unknown Sender")
                recipient = decode_str(headers_map.get("to") or connected_email)
                rfc_msg_id = decode_str(headers_map.get("message-id") or "").strip() or gmail_msg_id
                date_raw = decode_str(headers_map.get("date") or "")

                received_iso = now_iso
                if msg_json.get("internalDate"):
                    try:
                        ts_sec = int(msg_json["internalDate"]) / 1000.0
                        received_iso = datetime.datetime.utcfromtimestamp(ts_sec).isoformat()
                    except Exception:
                        pass
                elif date_raw:
                    try:
                        received_iso = parsedate_to_datetime(date_raw).isoformat()
                    except Exception:
                        received_iso = date_raw

                plain_parts: List[str] = []
                html_parts: List[str] = []
                attachments_meta: List[Dict[str, Any]] = []
                _extract_gmail_parts(payload, plain_parts, html_parts, attachments_meta)

                body_text = "\n".join(plain_parts).strip()
                if not body_text and html_parts:
                    body_text = _strip_html_tags("\n".join(html_parts))
                if not body_text:
                    body_text = (msg_json.get("snippet") or "").strip()

                # Check duplicate by RFC Message-ID or Gmail Message ID
                if is_email_message_already_processed(message_id=rfc_msg_id, gmail_message_id=gmail_msg_id):
                    skipped_duplicates += 1
                    continue

                # Download attachment payloads from Gmail API
                downloaded_attachments: List[Dict[str, Any]] = []
                for att_desc in attachments_meta:
                    fname = os.path.basename(att_desc["filename"])
                    att_bytes = b""
                    if att_desc.get("inline_data"):
                        att_bytes = _decode_base64url(att_desc["inline_data"])
                    elif att_desc.get("attachment_id"):
                        att_resp = client.get(
                            f"{GMAIL_API_BASE}/messages/{gmail_msg_id}/attachments/{att_desc['attachment_id']}",
                            headers=auth_headers
                        )
                        if att_resp.status_code == 200:
                            att_bytes = _decode_base64url(att_resp.json().get("data") or "")
                    if fname and att_bytes:
                        downloaded_attachments.append({
                            "filename": fname,
                            "payload": att_bytes,
                            "size": len(att_bytes)
                        })

                first_att_name = downloaded_attachments[0]["filename"] if downloaded_attachments else None
                first_att_size = downloaded_attachments[0]["size"] if downloaded_attachments else None

                filter_eval = evaluate_email_safety_and_filters(
                    sender=sender,
                    subject=subject,
                    filename=first_att_name,
                    file_size_bytes=first_att_size,
                    message_id=rfc_msg_id,
                    gmail_message_id=gmail_msg_id,
                    organization_id=organization_id
                )

                if not filter_eval["allowed"]:
                    if filter_eval.get("is_duplicate_message"):
                        skipped_duplicates += 1
                    else:
                        rejected_count += 1
                        email_state["total_rejected"] += 1
                        record_audit_log(
                            action="INGESTION_FAILED",
                            entity_type="EMAIL",
                            entity_id=gmail_msg_id,
                            user_id=connected_email or "Gmail OAuth Sync",
                            description=f"Gmail message '{subject}' from '{sender}' rejected by policy: {filter_eval['reason']}",
                            result="WARNING"
                        )
                    continue

                attachment_names = [a["filename"] for a in downloaded_attachments]
                base_email_meta = {
                    "gmail_message_id": gmail_msg_id,
                    "message_id": rfc_msg_id,
                    "thread_id": msg_json.get("threadId"),
                    "sender": sender,
                    "recipient": recipient,
                    "connected_email": connected_email,
                    "subject": subject,
                    "received_time": received_iso,
                    "department": department,
                    "provider": "Gmail",
                    "source": "Gmail",
                    "analysis_mode": mode,
                    "has_attachment": len(downloaded_attachments) > 0,
                    "attachment_count": len(downloaded_attachments),
                    "attachment_filenames": attachment_names,
                    "attachment_status": f"{len(downloaded_attachments)} Attachment(s)" if downloaded_attachments else "No Attachment",
                    "processing_status": "PROCESSED",
                    "is_demo": False,
                    "simulated": False,
                    "ingestion_mode": "REAL"
                }

                email_created_asset_ids: List[str] = []
                email_results_for_msg: List[Dict[str, Any]] = []

                # 1. Process Attachments through 7-Layer Verification Pipeline + Groq AI
                if mode in ("both", "attachments") and downloaded_attachments:
                    for att in downloaded_attachments:
                        fname = att["filename"]
                        att_check = evaluate_email_safety_and_filters(
                            sender=sender,
                            subject=subject,
                            filename=fname,
                            file_size_bytes=att["size"],
                            message_id=None,
                            gmail_message_id=None,
                            organization_id=organization_id
                        )
                        if not att_check["allowed"]:
                            email_state["total_rejected"] += 1
                            rejected_count += 1
                            continue

                        saved_att_path = os.path.join(UPLOAD_DIR, f"gmail_{uuid.uuid4().hex[:8]}_{fname}")
                        with open(saved_att_path, "wb") as tf:
                            tf.write(att["payload"])

                        att_res = run_7layer_verification_pipeline(
                            file_path=saved_att_path,
                            original_filename=fname,
                            department=department,
                            source=f"Gmail Ingestion Attachment ({sender})",
                            allow_duplicate=True,
                            email_metadata={
                                **base_email_meta,
                                "source_type": "email_attachment",
                                "attachment_filename": fname
                            }
                        )
                        processed_assets.append(att_res)
                        email_results_for_msg.append(att_res)
                        if att_res.get("asset_id"):
                            email_created_asset_ids.append(att_res["asset_id"])
                        email_state["total_attachments_processed"] += 1

                        record_audit_log(
                            action="ATTACHMENT_PROCESSED",
                            entity_type="ASSET",
                            entity_id=att_res.get("asset_id") or fname,
                            user_id=connected_email or "Gmail OAuth",
                            description=f"Processed Gmail attachment '{fname}' from '{sender}' (Trust Score: {att_res.get('trust_score')}, Risk: {att_res.get('risk_level')})."
                        )

                # 2. Process Email Body if mode is ("both", "body") or if no attachment was processed
                if body_text and (mode in ("both", "body") or not email_created_asset_ids):
                    clean_subj_slug = re.sub(r"[^a-zA-Z0-9_-]", "_", subject)[:28] or "Message"
                    body_filename = f"Gmail_{clean_subj_slug}.txt"
                    saved_body_path = os.path.join(UPLOAD_DIR, f"gmail_body_{uuid.uuid4().hex[:8]}_{body_filename}")
                    with open(saved_body_path, "w", encoding="utf-8") as tf:
                        tf.write(
                            f"From: {sender}\nTo: {recipient}\nSubject: {subject}\nDate: {received_iso}\nGmail-Message-ID: {gmail_msg_id}\n\n{body_text}"
                        )

                    body_res = run_7layer_verification_pipeline(
                        file_path=saved_body_path,
                        original_filename=body_filename,
                        department=department,
                        category="Email Message",
                        source=f"Gmail Ingestion ({sender})",
                        allow_duplicate=True,
                        email_metadata={
                            **base_email_meta,
                            "source_type": "email_body",
                            "related_attachment_asset_ids": list(email_created_asset_ids)
                        }
                    )
                    processed_assets.append(body_res)
                    email_results_for_msg.append(body_res)
                    if body_res.get("asset_id") and body_res["asset_id"] not in email_created_asset_ids:
                        email_created_asset_ids.append(body_res["asset_id"])
                    email_state["total_bodies_processed"] += 1

                if email_created_asset_ids:
                    processed_emails_count += 1
                    primary_res = email_results_for_msg[0]
                    ai_ins = primary_res.get("ai_insights") or {}
                    event = {
                        "email_id": gmail_msg_id,
                        "gmail_message_id": gmail_msg_id,
                        "message_id": rfc_msg_id,
                        "sender": sender,
                        "recipient": recipient,
                        "subject": subject,
                        "received_time": received_iso,
                        "department": department,
                        "provider": "Gmail",
                        "source": "Gmail",
                        "analysis_mode": mode,
                        "assets": email_created_asset_ids,
                        "asset_id": email_created_asset_ids[0],
                        "attachments": attachment_names,
                        "has_attachment": len(attachment_names) > 0,
                        "attachment_status": f"{len(attachment_names)} Attachment(s)" if attachment_names else "No Attachment (Body Verified)",
                        "processing_status": "PROCESSED",
                        "status": primary_res.get("status", "VERIFIED"),
                        "trust_score": primary_res.get("trust_score", 50.0),
                        "risk_level": primary_res.get("risk_level", "Medium Risk"),
                        "incident_id": primary_res.get("incident_id"),
                        "ai_summary": ai_ins.get("summary") or ai_ins.get("security_summary"),
                        "is_demo": False,
                        "simulated": False,
                        "ingestion_mode": "REAL",
                        "timestamp": datetime.datetime.utcnow().isoformat()
                    }
                    email_state["recent_events"].insert(0, event)
                    email_state["recent_events"] = email_state["recent_events"][:100]

                    record_audit_log(
                        action="EMAIL_INGESTED",
                        entity_type="EMAIL",
                        entity_id=gmail_msg_id,
                        user_id=connected_email or "Gmail OAuth",
                        description=f"Ingested real Gmail message '{subject}' from '{sender}' -> Asset(s): {email_created_asset_ids}."
                    )

        # Update last_sync_at in MongoDB `email_integrations`
        sync_done_iso = datetime.datetime.utcnow().isoformat()
        get_email_integrations_collection().update_one(
            {"organization_id": organization_id, "provider": "gmail"},
            {"$set": {"last_sync_at": sync_done_iso, "updated_at": sync_done_iso}}
        )

        email_state["last_poll_time"] = sync_done_iso
        email_state["last_poll_status"] = f"Synced ({processed_emails_count} new emails, {skipped_duplicates} duplicates skipped)"

        record_audit_log(
            action="GMAIL_SYNC_COMPLETED",
            entity_type="EMAIL_INTEGRATION",
            entity_id=organization_id,
            user_id=connected_email or "ADMIN",
            description=(
                f"Gmail synchronization completed for {connected_email}: "
                f"{processed_emails_count} new email(s) processed ({len(processed_assets)} asset(s)), "
                f"{skipped_duplicates} duplicate(s) skipped, {rejected_count} rejected."
            )
        )

        return {
            "success": True,
            "status": "success",
            "connected_email": connected_email,
            "last_sync_at": sync_done_iso,
            "processed_email_count": processed_emails_count,
            "processed_count": processed_emails_count,
            "processed_asset_count": len(processed_assets),
            "skipped_duplicates": skipped_duplicates,
            "rejected_count": rejected_count,
            "results": processed_assets,
            "message": (
                f"Gmail synchronized ({connected_email}): {processed_emails_count} new email(s) processed"
                f"{f', {skipped_duplicates} already-processed email(s) skipped' if skipped_duplicates else ''}."
            )
        }

    except Exception as exc:
        logger.error(f"Gmail synchronization error: {exc}", exc_info=True)
        email_state["total_errors"] += 1
        email_state["last_poll_status"] = f"Sync Error: {str(exc)}"
        record_audit_log(
            action="INGESTION_FAILED",
            entity_type="EMAIL_INTEGRATION",
            entity_id=organization_id,
            user_id="ADMIN",
            description=f"Gmail synchronization failed: {str(exc)}",
            result="WARNING"
        )
        return {
            "success": False,
            "status": "error",
            "processed_count": 0,
            "processed_email_count": 0,
            "skipped_duplicates": skipped_duplicates,
            "rejected_count": rejected_count,
            "message": f"Gmail synchronization error: {str(exc)}"
        }


def poll_email_inbox(department: str = "Operations") -> Dict[str, Any]:
    """
    Synchronizes the connected Gmail mailbox via Google OAuth 2.0.
    """
    return sync_gmail_messages(department=department)


# ============================================================
# DEMO EMAIL INGESTION MODE (DEVELOPMENT / TEST ONLY)
# ============================================================

def simulate_email_intake(
    sender: str,
    subject: str,
    body_text: Optional[str] = None,
    filename: Optional[str] = None,
    file_bytes: Optional[bytes] = None,
    department: str = "Operations",
    message_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Clearly labelled Development / Test Only DEMO EMAIL INGESTION mode.
    Validates sender, subject keywords, file extension, file size, and duplicate message_id,
    then runs the 7-layer TrustSphere verification pipeline + Groq AI analysis.
    """
    msg_id = (message_id or "").strip() or f"DEMO-{uuid.uuid4().hex[:8].upper()}@trustsphere.corp"
    now_iso = datetime.datetime.utcnow().isoformat()
    mode = _runtime_config.get("analysis_mode", "both")
    file_size = len(file_bytes) if file_bytes is not None else None

    email_state["total_emails_checked"] += 1

    # 1. Evaluate Email Safety & Filtering Rules
    filter_check = evaluate_email_safety_and_filters(
        sender=sender,
        subject=subject,
        filename=filename,
        file_size_bytes=file_size,
        message_id=msg_id
    )

    if not filter_check["allowed"]:
        email_state["total_rejected"] += 1
        record_audit_log(
            action="DUPLICATE_ASSET_SKIPPED" if filter_check.get("is_duplicate_message") else "INGESTION_FAILED",
            entity_type="EMAIL",
            entity_id=msg_id,
            user_id="Dev/Test Demo Email Gate",
            description=f"[DEV/TEST DEMO] Email from '{sender}' rejected: {filter_check['reason']}",
            result="WARNING"
        )
        return {
            "success": False,
            "rejected": True,
            "is_duplicate_message": filter_check.get("is_duplicate_message", False),
            "existing_asset_id": filter_check.get("existing_asset_id"),
            "message_id": msg_id,
            "ingestion_mode": "DEMO",
            "is_demo": True,
            "reason": filter_check["reason"],
            "created_assets": []
        }

    email_meta = {
        "message_id": msg_id,
        "sender": sender,
        "recipient": "demo-intake@trustsphere.corp",
        "subject": subject,
        "received_time": now_iso,
        "department": department,
        "provider": "Development / Test Only",
        "source": "Development / Test Only",
        "analysis_mode": mode,
        "has_attachment": bool(filename),
        "attachment_filenames": [filename] if filename else [],
        "attachment_status": f"1 Attachment ({filename})" if filename else "No Attachment",
        "processing_status": "PROCESSED",
        "simulated": True,
        "is_demo": True,
        "ingestion_mode": "DEMO"
    }

    results = []
    created_asset_ids = []

    # 2. Process Attachment if provided
    if filename and file_bytes is not None:
        safe_fname = os.path.basename(filename)
        saved_att_path = os.path.join(UPLOAD_DIR, f"demo_{uuid.uuid4().hex[:8]}_{safe_fname}")
        with open(saved_att_path, "wb") as tf:
            tf.write(file_bytes)

        att_res = run_7layer_verification_pipeline(
            file_path=saved_att_path,
            original_filename=safe_fname,
            department=department,
            source=f"Email Ingestion [DEV/TEST DEMO] Attachment ({sender})",
            allow_duplicate=False,
            email_metadata={**email_meta, "source_type": "email_attachment", "attachment_filename": safe_fname}
        )
        results.append(att_res)
        if att_res.get("asset_id"):
            created_asset_ids.append(att_res.get("asset_id"))
        email_state["total_attachments_processed"] += 1

    # 3. Process Body if present
    if body_text and body_text.strip() and (mode in ("both", "body") or not filename):
        clean_subj_slug = re.sub(r'[^a-zA-Z0-9_-]', '_', subject)[:24]
        body_filename = f"Demo_Email_Body_{clean_subj_slug}.txt"
        saved_body_path = os.path.join(UPLOAD_DIR, f"demo_{uuid.uuid4().hex[:8]}_{body_filename}")
        with open(saved_body_path, "w", encoding="utf-8") as tf:
            tf.write(body_text.strip())

        body_res = run_7layer_verification_pipeline(
            file_path=saved_body_path,
            original_filename=body_filename,
            department=department,
            category="Email Body",
            source=f"Email Ingestion [DEV/TEST DEMO] Body ({sender})",
            allow_duplicate=False,
            email_metadata={**email_meta, "source_type": "email_body"}
        )
        results.append(body_res)
        if body_res.get("asset_id") and body_res.get("asset_id") not in created_asset_ids:
            created_asset_ids.append(body_res.get("asset_id"))
        email_state["total_bodies_processed"] += 1

    primary_result = results[0] if results else {
        "success": False,
        "message": "No actionable content or attachment provided for Demo Email Ingestion."
    }

    if created_asset_ids:
        event = {
            "email_id": msg_id,
            "message_id": msg_id,
            "sender": sender,
            "recipient": "demo-intake@trustsphere.corp",
            "subject": subject,
            "received_time": now_iso,
            "department": department,
            "provider": "Development / Test Only",
            "source": "Development / Test Only",
            "analysis_mode": mode,
            "assets": created_asset_ids,
            "asset_id": created_asset_ids[0],
            "attachments": [filename] if filename else [],
            "has_attachment": bool(filename),
            "attachment_status": f"1 Attachment ({filename})" if filename else "No Attachment (Body Verified)",
            "processing_status": "PROCESSED",
            "status": primary_result.get("status", "VERIFIED"),
            "trust_score": primary_result.get("trust_score", 50.0),
            "risk_level": primary_result.get("risk_level", "Medium Risk"),
            "incident_id": primary_result.get("incident_id"),
            "ai_summary": primary_result.get("ai_insights", {}).get("summary") or primary_result.get("ai_insights", {}).get("security_summary"),
            "simulated": True,
            "is_demo": True,
            "ingestion_mode": "DEMO",
            "timestamp": now_iso
        }
        email_state["recent_events"].insert(0, event)
        email_state["recent_events"] = email_state["recent_events"][:100]

    record_audit_log(
        action="EMAIL_INGESTED",
        entity_type="EMAIL",
        entity_id=msg_id,
        user_id="Dev/Test Demo Email Gateway",
        description=f"[DEV/TEST DEMO] Email ingested from '{sender}' (Subject: '{subject}'). Generated assets: {created_asset_ids}."
    )

    return {
        "success": True,
        "rejected": False,
        "is_demo": True,
        "ingestion_mode": "DEMO",
        "message_id": msg_id,
        "created_assets": created_asset_ids,
        "primary_result": primary_result,
        "all_results": results
    }


async def email_ingestion_background_worker(poll_interval: Optional[int] = None):
    """
    Background worker that runs periodically during FastAPI lifespan.
    Synchronizes the connected Gmail inbox safely whenever OAuth is connected.
    """
    logger.info("TrustSphere Email Ingestion worker initialized.")
    try:
        while True:
            interval = max(15, int(_runtime_config.get("poll_interval") or poll_interval or 60))
            try:
                oauth_status = get_oauth_integration_status()
                if oauth_status.get("is_connected"):
                    _runtime_config["enabled"] = True
                    await asyncio.to_thread(sync_gmail_messages)
            except Exception as e:
                logger.error(f"Error in automatic Gmail ingestion cycle: {e}")
            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        logger.info("Email ingestion worker stopped.")
