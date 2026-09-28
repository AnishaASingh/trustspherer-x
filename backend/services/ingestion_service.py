import os
import shutil
import time
import datetime
import logging
from typing import Dict, Any, List, Optional
import asyncio

from services.verification_pipeline import run_7layer_verification_pipeline
from utils.audit import record_audit_log

logger = logging.getLogger("trustsphere.ingestion")

# Base directory for watched folder ingestion
BASE_PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_INGESTION_DIR = os.path.join(BASE_PROJECT_DIR, "ingestion")
INGESTION_DIR = os.environ.get("INGESTION_DIR", DEFAULT_INGESTION_DIR)

INCOMING_DIR = os.path.join(INGESTION_DIR, "incoming")
PROCESSED_DIR = os.path.join(INGESTION_DIR, "processed")
FAILED_DIR = os.path.join(INGESTION_DIR, "failed")

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".jpg", ".jpeg", ".png", ".txt"}
IGNORED_EXTENSIONS = {".tmp", ".crdownload", ".part", ".swp"}

# State tracker
ingestion_state = {
    "watcher_running": False,
    "last_scan_time": None,
    "total_files_processed": 0,
    "total_duplicates_skipped": 0,
    "total_errors": 0,
    "recent_events": []
}


def ensure_ingestion_directories() -> Dict[str, str]:
    """Ensures incoming, processed, and failed directories exist on disk."""
    for folder in [INCOMING_DIR, PROCESSED_DIR, FAILED_DIR]:
        os.makedirs(folder, exist_ok=True)
    return {
        "incoming": INCOMING_DIR,
        "processed": PROCESSED_DIR,
        "failed": FAILED_DIR
    }


def is_file_ready(file_path: str) -> bool:
    """Verifies that a file is not currently being copied/written to."""
    try:
        if not os.path.exists(file_path):
            return False
        initial_size = os.path.getsize(file_path)
        time.sleep(0.1)
        second_size = os.path.getsize(file_path)
        if initial_size != second_size:
            return False
        # Test opening for reading
        with open(file_path, "rb") as f:
            f.read(1024)
        return True
    except (IOError, OSError):
        return False


def process_single_ingestion_file(
    file_path: str,
    department: str = "Operations",
    source: str = "Enterprise Watched Folder"
) -> Dict[str, Any]:
    """
    Processes an incoming file through the unified 7-layer verification pipeline.
    Handles duplicate prevention and moves the file to processed or failed directories.
    """
    ensure_ingestion_directories()
    filename = os.path.basename(file_path)
    extension = os.path.splitext(filename)[1].lower()

    if extension in IGNORED_EXTENSIONS or filename.startswith((".", "~")):
        return {"status": "ignored", "reason": "Hidden or temporary file"}

    if extension not in SUPPORTED_EXTENSIONS:
        # Move to failed directory with reason
        timestamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        target_name = f"{timestamp}_{filename}"
        failed_path = os.path.join(FAILED_DIR, target_name)
        shutil.move(file_path, failed_path)
        with open(f"{failed_path}.error.txt", "w", encoding="utf-8") as f:
            f.write(f"Unsupported file format: {extension}\nSupported: {list(SUPPORTED_EXTENSIONS)}")
        ingestion_state["total_errors"] += 1
        return {"status": "failed", "reason": f"Unsupported extension: {extension}"}

    try:
        # Run unified 7-layer pipeline
        result = run_7layer_verification_pipeline(
            file_path=file_path,
            original_filename=filename,
            department=department,
            source=source,
            allow_duplicate=False
        )

        timestamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        target_name = f"{timestamp}_{filename}"
        processed_path = os.path.join(PROCESSED_DIR, target_name)

        # Move the source file to processed directory
        if os.path.exists(file_path):
            shutil.move(file_path, processed_path)

        if result.get("is_duplicate"):
            ingestion_state["total_duplicates_skipped"] += 1
            event = {
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "filename": filename,
                "status": "DUPLICATE_SKIPPED",
                "asset_id": result.get("asset_id"),
                "file_hash": result.get("file_hash")
            }
        else:
            ingestion_state["total_files_processed"] += 1
            event = {
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "filename": filename,
                "status": "VERIFIED",
                "asset_id": result.get("asset_id"),
                "trust_score": result.get("trust_score"),
                "risk": result.get("risk")
            }

        ingestion_state["recent_events"].insert(0, event)
        ingestion_state["recent_events"] = ingestion_state["recent_events"][:50]
        return result

    except Exception as error:
        logger.error(f"Error processing ingestion file {filename}: {error}", exc_info=True)
        timestamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        target_name = f"{timestamp}_{filename}"
        failed_path = os.path.join(FAILED_DIR, target_name)

        if os.path.exists(file_path):
            shutil.move(file_path, failed_path)
            with open(f"{failed_path}.error.txt", "w", encoding="utf-8") as f:
                f.write(f"Pipeline Execution Error: {str(error)}\nTimestamp: {timestamp}")

        ingestion_state["total_errors"] += 1
        record_audit_log(
            action="INGESTION_FAILED",
            entity_type="ASSET",
            entity_id=filename,
            user_id="SecOps Ingestion Gate",
            description=f"Automated ingestion failed for '{filename}': {str(error)}",
            result="CRITICAL"
        )
        return {"status": "error", "error": str(error), "filename": filename}


def scan_incoming_folder(department: str = "Operations") -> List[Dict[str, Any]]:
    """Scans the incoming folder and processes all pending files."""
    ensure_ingestion_directories()
    results = []

    try:
        incoming_files = [
            f for f in os.listdir(INCOMING_DIR)
            if os.path.isfile(os.path.join(INCOMING_DIR, f))
        ]
    except Exception as e:
        logger.error(f"Could not list incoming directory: {e}")
        return []

    for filename in incoming_files:
        file_path = os.path.join(INCOMING_DIR, filename)
        if is_file_ready(file_path):
            res = process_single_ingestion_file(file_path, department=department)
            results.append(res)

    ingestion_state["last_scan_time"] = datetime.datetime.utcnow().isoformat()
    return results


def get_ingestion_status() -> Dict[str, Any]:
    """Returns current telemetry and metrics for the watched folder ingestion engine."""
    ensure_ingestion_directories()

    def count_files(folder: str) -> int:
        try:
            return len([f for f in os.listdir(folder) if os.path.isfile(os.path.join(folder, f)) and not f.endswith(".error.txt")])
        except Exception:
            return 0

    return {
        "watcher_running": ingestion_state["watcher_running"],
        "folder_path": INGESTION_DIR,
        "incoming_dir": INCOMING_DIR,
        "processed_dir": PROCESSED_DIR,
        "failed_dir": FAILED_DIR,
        "incoming_count": count_files(INCOMING_DIR),
        "processed_count": count_files(PROCESSED_DIR),
        "failed_count": count_files(FAILED_DIR),
        "last_scan_time": ingestion_state["last_scan_time"],
        "total_files_processed": ingestion_state["total_files_processed"],
        "total_duplicates_skipped": ingestion_state["total_duplicates_skipped"],
        "total_errors": ingestion_state["total_errors"],
        "recent_events": ingestion_state["recent_events"][:15]
    }


async def watched_folder_background_worker(poll_interval: int = 5):
    """
    Background worker that runs continuously during FastAPI lifecycle,
    monitoring the incoming directory for dropped assets.
    """
    ensure_ingestion_directories()
    ingestion_state["watcher_running"] = True
    logger.info(f"TrustSphere Watched-Folder Ingestion active. Monitoring: {INCOMING_DIR}")

    try:
        while True:
            try:
                scan_incoming_folder()
            except Exception as e:
                logger.error(f"Error in background ingestion loop: {e}")
            await asyncio.sleep(poll_interval)
    except asyncio.CancelledError:
        logger.info("Watched-folder ingestion worker stopped.")
    finally:
        ingestion_state["watcher_running"] = False
