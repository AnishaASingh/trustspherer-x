import os
import sys
import shutil
import uuid
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
existing_pythonpath = os.environ.get("PYTHONPATH", "")
if BACKEND_DIR not in existing_pythonpath.split(os.pathsep):
    os.environ["PYTHONPATH"] = f"{BACKEND_DIR}{os.pathsep}{existing_pythonpath}" if existing_pythonpath else BACKEND_DIR

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from dotenv import load_dotenv

load_dotenv(os.path.join(BACKEND_DIR, ".env"))

# Database helpers and collections
from database import (
    init_db,
    check_db_connection,
    get_assets_collection,
    get_verifications_collection,
    get_trust_scores_collection,
    get_recommendations_collection,
    get_incidents_collection,
    get_audit_logs_collection,
    get_departments_collection
)

# Existing Teammate Services (Source of Truth - Preserved)
from services.file_integrity import calculate_file_hash
from services.metadata import analyze_metadata
from services.pdf_analyzer import analyze_pdf
from services.docx_analyzer import analyze_docx
from services.image_analyzer import analyze_image
from services.content_analyzer import analyze_content
from services.pii_detector import detect_pii
from services.anomaly_detector import detect_anomaly
from services.risk_engine import calculate_risk
from services.trust_engine import generate_trust_result
from services.trust_service import calculate_trust_score
from services.threat_service import analyze_threat
from services.document_service import analyze_document
from services.verification_pipeline import run_7layer_verification_pipeline
from services.ingestion_service import watched_folder_background_worker
from services.email_ingestion import email_ingestion_background_worker

from utils.file_validator import validate_file
from utils.audit import record_audit_log

# Routers
from routers import auth, assets, incidents, employees, departments, audit_logs, dashboard, digital_twin, ingestion, users, ai



# ============================================================
# LIFESPAN CONTEXT (DATABASE INITIALIZATION & INGESTION TASKS)
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize MongoDB collections and indexes
    init_db()
    # Background workers for watched-folder and email ingestion
    folder_task = asyncio.create_task(watched_folder_background_worker(poll_interval=5))
    email_task = asyncio.create_task(email_ingestion_background_worker(poll_interval=60))
    yield
    # Graceful shutdown
    folder_task.cancel()
    email_task.cancel()


# ============================================================
# CREATE FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="TrustSphere API",
    description="Enterprise Digital Asset Trust and Risk Intelligence Platform",
    version="2.0.0",
    lifespan=lifespan
)


# ============================================================
# ERROR HANDLING (PHASE 2 SECTION 11 - CONSISTENT JSON)
# ============================================================

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": str(exc.detail)
        }
    )

@app.exception_handler(RequestValidationError)
async def custom_validation_exception_handler(request: Request, exc: RequestValidationError):
    error_msg = exc.errors()[0]["msg"] if exc.errors() else "Validation failed"
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": f"Input validation error: {error_msg}"
        }
    )


# ============================================================
# CORS CONFIGURATION (PHASE 2 SECTION 12)
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# UPLOAD DIRECTORY
# ============================================================

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============================================================
# MOUNT MODULAR ROUTERS (PHASE 2)
# ============================================================

app.include_router(auth.router)
app.include_router(assets.router)
app.include_router(incidents.router)
app.include_router(employees.router)
app.include_router(departments.router)
app.include_router(audit_logs.router)
app.include_router(dashboard.router)
app.include_router(digital_twin.router)
app.include_router(ingestion.router)
app.include_router(users.router)
app.include_router(ai.router)



# ============================================================
# HOME / HEALTH ENDPOINTS
# ============================================================

@app.get("/")
def home():
    return {
        "success": True,
        "data": {
            "application": "TrustSphere",
            "version": "2.0.0",
            "status": "running",
            "message": "TrustSphere Backend API is operational"
        }
    }


@app.get("/health")
@app.get("/api/health")
def health_check():
    db_health = check_db_connection()
    is_healthy = db_health.get("status") == "connected"
    return {
        "success": is_healthy,
        "data": {
            "status": "healthy" if is_healthy else "degraded",
            "application": "TrustSphere",
            "timestamp": datetime.utcnow().isoformat(),
            "database": db_health
        }
    }


# ============================================================
# PRESERVED TEAMMATE ANALYZE ENDPOINT
# ============================================================

@app.post("/analyze")
def analyze_text_document(text: str, department: str = "Finance"):
    doc_result = analyze_document(text)
    risk_score = doc_result.get("risk_score", 0)
    trust_result = calculate_trust_score(
        sender_trust=20,
        document_risk=risk_score,
        behavior_risk=10,
        network_risk=10
    )
    threat_result = analyze_threat(department=department, risk_score=risk_score)
    return {
        "success": True,
        "data": {
            "document_analysis": doc_result,
            "trust_analysis": trust_result,
            "threat_propagation": threat_result
        }
    }


# ============================================================
# CORE VERIFICATION ENDPOINT: POST /api/verify (PHASE 2 SECTION 3)
# ============================================================

@app.post("/api/verify")
async def verify_document(
    file: UploadFile = File(...),
    department: Optional[str] = Form("Finance"),
    category: Optional[str] = Form(None),
    source: Optional[str] = Form("Enterprise File Intake")
):
    # --------------------------------------------------------
    # 1. FILE VALIDATION
    # --------------------------------------------------------
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file selected."
        )

    validation = validate_file(file.filename)
    if not validation["valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=validation["message"]
        )

    # --------------------------------------------------------
    # 2. SAVE UPLOADED FILE TO LOCAL ENCLAVE
    # --------------------------------------------------------
    file_id = str(uuid.uuid4())
    extension = os.path.splitext(file.filename)[1].lower()
    saved_filename = f"{file_id}{extension}"
    file_path = os.path.join(UPLOAD_DIR, saved_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File upload to local enclave failed: {str(error)}"
        )

    # --------------------------------------------------------
    # 3. RUN UNIFIED 7-LAYER VERIFICATION PIPELINE
    # --------------------------------------------------------
    try:
        result = run_7layer_verification_pipeline(
            file_path=file_path,
            original_filename=file.filename,
            department=department or "Finance",
            category=category,
            source=source or "Enterprise File Intake",
            allow_duplicate=False
        )
    except Exception as pipe_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification pipeline failed: {str(pipe_err)}"
        )

    if result.get("is_duplicate"):
        return {
            "success": True,
            "data": result,
            "message": result.get("message", "Cryptographic duplicate asset skipped.")
        }

    factors_dict = result.get("factors", {})

    return {
        "success": True,
        "data": result,
        # Backwards compatibility keys
        "assetId": result.get("asset_id"),
        "verificationId": result.get("verification_id"),
        "incidentId": result.get("incident_id"),
        "trustScore": result.get("trust_score"),
        "risk": result.get("risk"),
        "status": result.get("status"),
        "factors": factors_dict,
        "checks": result.get("checks", []),
        "anomalies": result.get("anomalies", []),
        "recommendations": result.get("recommendations", []),
        "file_hash": result.get("file_hash"),
        "filename": file.filename,
        "ai_insights": result.get("ai_insights")
    }



# ============================================================
# SERVER RUNNER
# ============================================================

if __name__ == "__main__":
    import uvicorn
    os.chdir(BACKEND_DIR)
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=[BACKEND_DIR]
    )