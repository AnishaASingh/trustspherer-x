from datetime import datetime
from typing import Optional, Dict, Any
from database import get_audit_logs_collection

def record_audit_log(
    action: str,
    entity_type: str,
    entity_id: str,
    description: str,
    user_id: str = "SYSTEM",
    result: str = "SUCCESS"
) -> Dict[str, Any]:
    """
    Inserts a standardized audit log entry into the audit_logs collection.
    """
    now_iso = datetime.utcnow().isoformat()
    log_doc = {
        "action": action,
        "entity_type": entity_type,
        "entity_id": str(entity_id),
        "user_id": str(user_id),
        "description": description,
        "result": result,
        "timestamp": now_iso
    }

    try:
        col = get_audit_logs_collection()
        insert_result = col.insert_one(log_doc)
        log_doc["_id"] = str(insert_result.inserted_id)
        return log_doc
    except Exception as exc:
        print(f"[Audit Log Error] Failed to write audit log: {exc}")
        log_doc["_id"] = "unpersisted"
        return log_doc
