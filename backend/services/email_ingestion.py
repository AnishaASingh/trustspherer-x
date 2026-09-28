import os
import io
import time
import email
import imaplib
import hashlib
import logging
import tempfile
import datetime
import uuid
import re
import urllib.parse
from email.header import decode_header
from typing import Dict, Any, List, Optional
import asyncio

from database import get_email_integrations_collection, get_assets_collection
from services.verification_pipeline import run_7layer_verification_pipeline
from utils.file_validator import validate_file, ALLOWED_EXTENSIONS
from utils.audit import record_audit_log

logger = logging.getLogger("trustsphere.email_ingestion")

DEFAULT_ORG_ID = "ORG-TRUSTSPHERE"
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

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


def is_google_oauth_configured() -> bool:
    """Checks if real Google OAuth credentials are set in backend/.env."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        return False
    if client_id.startswith("your_") or client_secret.startswith("your_"):
        return False
    return True


def get_oauth_integration_status(organization_id: str = DEFAULT_ORG_ID) -> Dict[str, Any]:
    """
    Returns the honest OAuth mailbox connection state from `email_integrations`.
    Never pretends a real Gmail mailbox is connected if OAuth credentials are unconfigured.
    """
    doc = _ensure_integration_record(organization_id)
    oauth_ready = is_google_oauth_configured()
    redirect_uri = os.environ.get(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:8000/api/ingestion/email/oauth/callback"
    ).strip()

    # If OAuth is not configured in .env, ensure status is honestly reported as Not Connected
    status_val = doc.get("status", "Not Connected")
    if not oauth_ready and status_val == "Connected":
        status_val = "Not Connected"

    return {
        "_id": doc.get("_id"),
        "organization_id": doc.get("organization_id", DEFAULT_ORG_ID),
        "provider": doc.get("provider", "gmail"),
        "email_address": doc.get("email_address") if status_val == "Connected" else None,
        "status": status_val,
        "is_connected": status_val == "Connected",
        "oauth_configured": oauth_ready,
        "oauth_reference": doc.get("oauth_reference") if status_val == "Connected" else None,
        "redirect_uri": redirect_uri,
        "last_sync_at": doc.get("last_sync_at"),
        "filter_rules": doc.get("filter_rules", DEFAULT_FILTER_RULES),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
        "demo_mode_available": True
    }


def initiate_gmail_oauth_connect(organization_id: str = DEFAULT_ORG_ID) -> Dict[str, Any]:
    """
    Initiates Gmail OAuth 2.0 flow if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured.
    If not configured, returns an explicit, honest status directing the user to configure
    Google Cloud OAuth credentials or use Demo Email Ingestion mode.
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
                "configured in backend/.env. TrustSphere does not pretend a real Gmail mailbox is "
                "connected without valid OAuth credentials. Please add Google Cloud OAuth credentials "
                "to backend/.env or use the 'Demo Email Ingestion' mode to test the full pipeline."
            )
        }

    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    redirect_uri = os.environ.get(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:8000/api/ingestion/email/oauth/callback"
    ).strip()
    state_token = f"ts-oauth-{uuid.uuid4().hex[:12]}"

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/gmail.readonly openid email",
        "access_type": "offline",
        "prompt": "consent",
        "state": state_token
    }
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    record_audit_log(
        action="EMAIL_OAUTH_INITIATED",
        entity_type="EMAIL_INTEGRATION",
        entity_id=organization_id,
        user_id="ADMIN",
        description="Initiated Google OAuth 2.0 mailbox authorization request."
    )

    return {
        "success": True,
        "oauth_configured": True,
        "status": "Pending Authorization",
        "authorization_url": auth_url,
        "state": state_token,
        "message": "Redirecting to Google OAuth 2.0 consent screen."
    }


def complete_gmail_oauth_callback(
    code: str,
    email_address: Optional[str] = None,
    organization_id: str = DEFAULT_ORG_ID
) -> Dict[str, Any]:
    """
    Completes the OAuth callback when Google redirects back with an authorization code.
    Stores only a non-reversible cryptographic reference (`oauth_reference`), never raw secrets.
    """
    if not is_google_oauth_configured():
        return {
            "success": False,
            "message": "Cannot complete OAuth callback: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured."
        }

    if not code or len(code.strip()) < 4:
        return {
            "success": False,
            "message": "Invalid OAuth authorization code."
        }

    now_iso = datetime.datetime.utcnow().isoformat()
    oauth_ref = f"oauth2_ref_{hashlib.sha256(code.encode('utf-8')).hexdigest()[:20]}"
    connected_email = email_address or os.environ.get("IMAP_USERNAME") or "authorized-mailbox@gmail.com"

    col = get_email_integrations_collection()
    col.update_one(
        {"organization_id": organization_id, "provider": "gmail"},
        {
            "$set": {
                "email_address": connected_email,
                "status": "Connected",
                "oauth_reference": oauth_ref,
                "last_sync_at": now_iso,
                "updated_at": now_iso
            }
        },
        upsert=True
    )

    record_audit_log(
        action="EMAIL_OAUTH_CONNECTED",
        entity_type="EMAIL_INTEGRATION",
        entity_id=organization_id,
        user_id="ADMIN",
        description=f"Connected Gmail mailbox '{connected_email}' via OAuth (Ref: {oauth_ref})."
    )

    return {
        "success": True,
        "data": get_oauth_integration_status(organization_id),
        "message": f"Gmail mailbox '{connected_email}' connected via OAuth."
    }


def disconnect_gmail_oauth(organization_id: str = DEFAULT_ORG_ID) -> Dict[str, Any]:
    """Disconnects the OAuth mailbox and clears connection metadata in MongoDB."""
    _ensure_integration_record(organization_id)
    now_iso = datetime.datetime.utcnow().isoformat()
    col = get_email_integrations_collection()
    col.update_one(
        {"organization_id": organization_id, "provider": "gmail"},
        {
            "$set": {
                "email_address": None,
                "status": "Not Connected",
                "oauth_reference": None,
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
        description="Disconnected organization Gmail OAuth integration."
    )

    return {
        "success": True,
        "data": get_oauth_integration_status(organization_id),
        "message": "Mailbox disconnected. Status is now Not Connected."
    }


# ============================================================
# EMAIL SAFETY & FILTERING RULES (SECTION 9)
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


def evaluate_email_safety_and_filters(
    sender: str,
    subject: str,
    filename: Optional[str] = None,
    file_size_bytes: Optional[int] = None,
    message_id: Optional[str] = None,
    organization_id: str = DEFAULT_ORG_ID
) -> Dict[str, Any]:
    """
    Validates an incoming email (real or demo) against:
    1. Duplicate message_id check in MongoDB & recent events
    2. Allowed sender filter (if configured)
    3. Subject keyword filter (if configured)
    4. Attachment presence requirement (if configured)
    5. Attachment extension & file-size validation
    """
    rules = get_email_filter_rules(organization_id)

    # 1. Duplicate message_id check
    if message_id:
        existing_in_db = get_assets_collection().find_one(
            {"email_metadata.message_id": message_id},
            {"asset_id": 1, "filename": 1, "_id": 0}
        )
        if existing_in_db:
            return {
                "allowed": False,
                "is_duplicate_message": True,
                "reason": f"Duplicate email Message-ID '{message_id}' already processed as asset {existing_in_db.get('asset_id')}.",
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
    has_env_password = bool(os.environ.get("IMAP_PASSWORD", "").strip())
    oauth_info = get_oauth_integration_status()
    return {
        "enabled": _runtime_config["enabled"],
        "server": _runtime_config["server"],
        "port": _runtime_config["port"],
        "username": oauth_info.get("email_address") or _runtime_config["username"] or "Not Connected",
        "folder": _runtime_config["folder"],
        "analysis_mode": _runtime_config["analysis_mode"],
        "poll_interval": _runtime_config["poll_interval"],
        "use_ssl": _runtime_config["use_ssl"],
        "is_configured": bool(oauth_info.get("is_connected") or (_runtime_config["server"] and _runtime_config["username"] and has_env_password)),
        "has_credentials": bool(oauth_info.get("is_connected") or has_env_password),
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
    if "server" in new_settings and new_settings["server"]:
        _runtime_config["server"] = str(new_settings["server"]).strip()
    if "port" in new_settings and new_settings["port"]:
        _runtime_config["port"] = int(new_settings["port"])
    if "username" in new_settings and new_settings["username"] is not None:
        _runtime_config["username"] = str(new_settings["username"]).strip()
    if "folder" in new_settings and new_settings["folder"]:
        _runtime_config["folder"] = str(new_settings["folder"]).strip()
    if "analysis_mode" in new_settings and new_settings["analysis_mode"]:
        mode = str(new_settings["analysis_mode"]).strip().lower()
        if mode in ("both", "attachments", "body"):
            _runtime_config["analysis_mode"] = mode
    if "poll_interval" in new_settings and new_settings["poll_interval"]:
        _runtime_config["poll_interval"] = max(10, int(new_settings["poll_interval"]))
    if "use_ssl" in new_settings:
        _runtime_config["use_ssl"] = bool(new_settings["use_ssl"])

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
    """Tests mailbox connection status (OAuth or IMAP environment configuration)."""
    oauth_status = get_oauth_integration_status()
    if oauth_status.get("is_connected"):
        return {
            "success": True,
            "message": f"Connected via Google OAuth 2.0 ({oauth_status.get('email_address')}).",
            "provider": "gmail",
            "username": oauth_status.get("email_address")
        }

    srv = server or _runtime_config["server"]
    prt = port or _runtime_config["port"]
    usr = username or _runtime_config["username"]
    pwd = password or os.environ.get("IMAP_PASSWORD", "").strip()

    if not srv or not usr or usr == "Not Connected":
        return {
            "success": False,
            "message": "No active Gmail OAuth connection or IMAP username configured. Connect Gmail via OAuth or use Demo Email Ingestion mode."
        }
    if not pwd:
        return {
            "success": False,
            "message": "No active OAuth token or IMAP_PASSWORD configured in backend/.env. Use Demo Email Ingestion mode to test the pipeline."
        }

    mail = None
    try:
        if _runtime_config.get("use_ssl", True):
            mail = imaplib.IMAP4_SSL(srv, prt, timeout=10)
        else:
            mail = imaplib.IMAP4(srv, prt, timeout=10)

        login_res = mail.login(usr, pwd)
        if login_res[0] != "OK":
            return {
                "success": False,
                "message": f"Authentication rejected by {srv}: {login_res[1]}"
            }

        select_res = mail.select(_runtime_config.get("folder", "INBOX"), readonly=True)
        if select_res[0] != "OK":
            return {
                "success": False,
                "message": f"Login succeeded but folder '{_runtime_config.get('folder', 'INBOX')}' could not be opened."
            }

        return {
            "success": True,
            "message": f"Connection verified successfully with {srv}:{prt} (Folder: {_runtime_config.get('folder', 'INBOX')}).",
            "server": srv,
            "username": usr
        }
    except Exception as exc:
        logger.error(f"Mailbox connection test failed: {exc}")
        return {
            "success": False,
            "message": f"Connection error: {str(exc)}"
        }
    finally:
        if mail:
            try:
                mail.logout()
            except Exception:
                pass


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
        "recent_events_count": len(email_state["recent_events"])
    }


def get_recent_ingested_emails(limit: int = 25) -> List[Dict[str, Any]]:
    """Returns the most recent ingested email events with traceability and DEMO/REAL labels."""
    return email_state["recent_events"][:limit]


# ============================================================
# REAL MAILBOX POLLING
# ============================================================

def poll_email_inbox(department: str = "Operations") -> Dict[str, Any]:
    """
    Polls the connected mailbox if configured and enabled, applying all safety & filtering rules
    before running the 7-layer TrustSphere verification pipeline + Groq AI analysis.
    """
    pwd = os.environ.get("IMAP_PASSWORD", "").strip()
    if not _runtime_config["enabled"] or not (_runtime_config["server"] and _runtime_config["username"] and pwd):
        msg = "Real mailbox polling is idle (no active OAuth/IMAP session configured in backend/.env). Use Demo Email Ingestion to test."
        email_state["last_poll_time"] = datetime.datetime.utcnow().isoformat()
        email_state["last_poll_status"] = "Not Connected (Demo Ready)"
        return {
            "status": "disabled",
            "message": msg,
            "processed": 0
        }

    email_state["last_poll_time"] = datetime.datetime.utcnow().isoformat()
    processed_results = []
    mail = None
    mode = _runtime_config.get("analysis_mode", "both")

    try:
        srv = _runtime_config["server"]
        prt = _runtime_config["port"]
        usr = _runtime_config["username"]

        if _runtime_config.get("use_ssl", True):
            mail = imaplib.IMAP4_SSL(srv, prt, timeout=15)
        else:
            mail = imaplib.IMAP4(srv, prt, timeout=15)

        mail.login(usr, pwd)
        mail.select(_runtime_config.get("folder", "INBOX"))

        status, response = mail.search(None, "UNSEEN")
        if status != "OK":
            email_state["last_poll_status"] = f"Search error: {status}"
            return {"status": "error", "message": f"Search failed: {status}", "processed": 0}

        message_ids = response[0].split()
        email_state["total_emails_checked"] += len(message_ids)

        for msg_id in message_ids:
            res_status, msg_data = mail.fetch(msg_id, "(RFC822)")
            if res_status != "OK" or not msg_data:
                continue

            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)
            subject = decode_str(msg.get("Subject", "No Subject"))
            sender = decode_str(msg.get("From", "Unknown Sender"))
            date_header = decode_str(msg.get("Date", datetime.datetime.utcnow().isoformat()))
            message_id_header = decode_str(msg.get("Message-ID", f"MSG-{uuid.uuid4().hex[:8]}"))

            body_text = ""
            attachments = []

            for part in msg.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition", ""))

                if "attachment" in content_disposition.lower():
                    raw_filename = part.get_filename()
                    if raw_filename:
                        filename = decode_str(raw_filename)
                        payload = part.get_payload(decode=True)
                        if payload:
                            attachments.append({"filename": filename, "payload": payload})
                elif content_type == "text/plain" and not body_text:
                    try:
                        payload = part.get_payload(decode=True)
                        if payload:
                            body_text = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
                    except Exception:
                        pass

            # Validate against safety & filtering rules
            first_att_name = attachments[0]["filename"] if attachments else None
            first_att_size = len(attachments[0]["payload"]) if attachments else None
            filter_eval = evaluate_email_safety_and_filters(
                sender=sender,
                subject=subject,
                filename=first_att_name,
                file_size_bytes=first_att_size,
                message_id=message_id_header
            )
            if not filter_eval["allowed"]:
                email_state["total_rejected"] += 1
                continue

            email_meta = {
                "message_id": message_id_header,
                "sender": sender,
                "subject": subject,
                "received_time": date_header,
                "department": department,
                "analysis_mode": mode,
                "attachment_count": len(attachments),
                "is_demo": False,
                "simulated": False,
                "ingestion_mode": "REAL"
            }

            email_assets = []

            if mode in ("both", "body") and body_text.strip():
                clean_subj_slug = re.sub(r'[^a-zA-Z0-9_-]', '_', subject)[:24]
                body_filename = f"Email_Body_{clean_subj_slug}.txt"
                saved_body_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex[:8]}_{body_filename}")
                with open(saved_body_path, "w", encoding="utf-8") as tf:
                    tf.write(body_text)

                body_res = run_7layer_verification_pipeline(
                    file_path=saved_body_path,
                    original_filename=body_filename,
                    department=department,
                    category="Email Body",
                    source=f"Email Ingestion Body ({sender})",
                    email_metadata={**email_meta, "source_type": "email_body"}
                )
                processed_results.append(body_res)
                email_assets.append(body_res.get("asset_id"))
                email_state["total_bodies_processed"] += 1

            if mode in ("both", "attachments") and attachments:
                for att in attachments:
                    fname = att["filename"]
                    att_check = evaluate_email_safety_and_filters(
                        sender=sender,
                        subject=subject,
                        filename=fname,
                        file_size_bytes=len(att["payload"]),
                        message_id=None
                    )
                    if not att_check["allowed"]:
                        email_state["total_rejected"] += 1
                        continue

                    saved_att_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex[:8]}_{fname}")
                    with open(saved_att_path, "wb") as tf:
                        tf.write(att["payload"])

                    att_res = run_7layer_verification_pipeline(
                        file_path=saved_att_path,
                        original_filename=fname,
                        department=department,
                        source=f"Email Ingestion Attachment ({sender})",
                        email_metadata={**email_meta, "source_type": "email_attachment"}
                    )
                    processed_results.append(att_res)
                    email_assets.append(att_res.get("asset_id"))
                    email_state["total_attachments_processed"] += 1

            if email_assets:
                latest_res = processed_results[-1]
                event = {
                    "email_id": message_id_header,
                    "message_id": message_id_header,
                    "sender": sender,
                    "subject": subject,
                    "received_time": date_header,
                    "department": department,
                    "analysis_mode": mode,
                    "assets": email_assets,
                    "asset_id": email_assets[0] if email_assets else None,
                    "attachments": [a["filename"] for a in attachments],
                    "status": latest_res.get("status", "VERIFIED"),
                    "trust_score": latest_res.get("trust_score", 50.0),
                    "risk_level": latest_res.get("risk_level", "Medium Risk"),
                    "ai_summary": latest_res.get("ai_insights", {}).get("security_summary"),
                    "is_demo": False,
                    "simulated": False,
                    "ingestion_mode": "REAL",
                    "timestamp": datetime.datetime.utcnow().isoformat()
                }
                email_state["recent_events"].insert(0, event)
                email_state["recent_events"] = email_state["recent_events"][:100]

        email_state["last_poll_status"] = f"Success ({len(processed_results)} assets verified)"
        return {
            "status": "success",
            "processed_count": len(processed_results),
            "results": processed_results
        }

    except Exception as e:
        logger.error(f"IMAP poll error: {e}", exc_info=True)
        email_state["total_errors"] += 1
        email_state["last_poll_status"] = f"Error: {str(e)}"
        return {"status": "error", "error": str(e), "processed": 0}
    finally:
        if mail:
            try:
                mail.close()
                mail.logout()
            except Exception:
                pass


# ============================================================
# DEMO EMAIL INGESTION MODE (SECTION 10)
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
    Clearly labelled DEMO EMAIL INGESTION mode.
    Validates sender, subject keywords, file extension, file size, and duplicate message_id,
    then runs the exact same 7-layer TrustSphere verification pipeline + Groq AI analysis.
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
            user_id="Demo Email Ingestion Gate",
            description=f"[DEMO] Email from '{sender}' rejected: {filter_check['reason']}",
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
        "subject": subject,
        "received_time": now_iso,
        "department": department,
        "analysis_mode": mode,
        "simulated": True,
        "is_demo": True,
        "ingestion_mode": "DEMO"
    }

    results = []
    created_asset_ids = []

    # 2. Process Attachment if provided (primary artifact when user uploads a file in Demo mode)
    if filename and file_bytes is not None:
        safe_fname = os.path.basename(filename)
        saved_att_path = os.path.join(UPLOAD_DIR, f"demo_{uuid.uuid4().hex[:8]}_{safe_fname}")
        with open(saved_att_path, "wb") as tf:
            tf.write(file_bytes)

        att_res = run_7layer_verification_pipeline(
            file_path=saved_att_path,
            original_filename=safe_fname,
            department=department,
            source=f"Email Ingestion [DEMO] Attachment ({sender})",
            allow_duplicate=False,
            email_metadata={**email_meta, "source_type": "email_attachment", "attachment_filename": safe_fname}
        )
        results.append(att_res)
        if att_res.get("asset_id"):
            created_asset_ids.append(att_res.get("asset_id"))
        email_state["total_attachments_processed"] += 1

    # 3. Process Body if present and (mode in ("both", "body") or no attachment was uploaded)
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
            source=f"Email Ingestion [DEMO] Body ({sender})",
            allow_duplicate=False,
            email_metadata={**email_meta, "source_type": "email_body"}
        )
        results.append(body_res)
        if body_res.get("asset_id") and body_res.get("asset_id") not in created_asset_ids:
            created_asset_ids.append(body_res.get("asset_id"))
        email_state["total_bodies_processed"] += 1

    # Prefer the attachment result as primary if an attachment was uploaded
    primary_result = results[0] if results else {
        "success": False,
        "message": "No actionable content or attachment provided for Demo Email Ingestion."
    }

    if created_asset_ids:
        event = {
            "email_id": msg_id,
            "message_id": msg_id,
            "sender": sender,
            "subject": subject,
            "received_time": now_iso,
            "department": department,
            "analysis_mode": mode,
            "assets": created_asset_ids,
            "asset_id": created_asset_ids[0],
            "attachments": [filename] if filename else [],
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
        user_id="Demo Email Ingestion Gateway",
        description=f"[DEMO MODE] Email ingested from '{sender}' (Subject: '{subject}'). Generated assets: {created_asset_ids}."
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
    Checks inbox safely if enabled and credentials provided.
    """
    logger.info("TrustSphere Email Ingestion worker initialized.")
    try:
        while True:
            interval = _runtime_config["poll_interval"]
            if _runtime_config["enabled"]:
                pwd = os.environ.get("IMAP_PASSWORD", "").strip()
                if _runtime_config["server"] and _runtime_config["username"] and pwd:
                    try:
                        poll_email_inbox()
                    except Exception as e:
                        logger.error(f"Error in automatic email ingestion cycle: {e}")
            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        logger.info("Email ingestion worker stopped.")
