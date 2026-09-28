import os
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status

from database import (
    get_assets_collection,
    get_verifications_collection,
    get_trust_scores_collection,
    get_recommendations_collection,
    get_incidents_collection
)
from schemas.common import ApiResponse, ApiErrorResponse
from utils.audit import record_audit_log

# Existing verification services
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

router = APIRouter(prefix="/api/assets", tags=["Assets"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


@router.get("", response_model=ApiResponse[Dict[str, Any]])
@router.get("/", response_model=ApiResponse[Dict[str, Any]])
def list_assets(
    department: Optional[str] = None,
    risk_level: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500)
):
    query: Dict[str, Any] = {}
    if department and department.upper() != "ALL":
        query["department_id"] = {"$regex": f"^{department}$", "$options": "i"}
    if risk_level and risk_level.upper() != "ALL":
        query["risk_level"] = {"$regex": f"^{risk_level}", "$options": "i"}
    if status and status.upper() != "ALL":
        query["status"] = {"$regex": f"^{status}$", "$options": "i"}
    if search and search.strip():
        q = search.strip()
        query["$or"] = [
            {"filename": {"$regex": q, "$options": "i"}},
            {"asset_id": {"$regex": q, "$options": "i"}},
            {"file_hash": {"$regex": q, "$options": "i"}}
        ]

    assets_col = get_assets_collection()
    assets = list(assets_col.find(query).sort("upload_date", -1).limit(limit))
    for a in assets:
        a["_id"] = str(a["_id"])

    return ApiResponse(
        success=True,
        data={"count": len(assets), "assets": assets}
    )


@router.get("/{asset_id}", response_model=ApiResponse[Dict[str, Any]])
def get_asset_details(asset_id: str):
    assets_col = get_assets_collection()
    asset = assets_col.find_one({"asset_id": asset_id})
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset '{asset_id}' not found."
        )

    asset["_id"] = str(asset["_id"])

    # Attach verification details
    ver_col = get_verifications_collection()
    verification = ver_col.find_one({"asset_id": asset_id})
    if verification:
        verification["_id"] = str(verification["_id"])

    # Attach trust scores
    trust_col = get_trust_scores_collection()
    trust_score = trust_col.find_one({"asset_id": asset_id})
    if trust_score:
        trust_score["_id"] = str(trust_score["_id"])

    # Attach recommendations
    rec_col = get_recommendations_collection()
    recs = list(rec_col.find({"asset_id": asset_id}))
    for r in recs:
        r["_id"] = str(r["_id"])

    # Attach incidents
    inc_col = get_incidents_collection()
    incidents = list(inc_col.find({"asset_id": asset_id}))
    for i in incidents:
        i["_id"] = str(i["_id"])

    return ApiResponse(
        success=True,
        data={
            "asset": asset,
            "verification": verification,
            "trust_score": trust_score,
            "recommendations": recs,
            "incidents": incidents
        }
    )


@router.get("/{asset_id}/recommendations", response_model=ApiResponse[List[Dict[str, Any]]])
def get_asset_recommendations(asset_id: str):
    assets_col = get_assets_collection()
    asset = assets_col.find_one({"asset_id": asset_id})
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset '{asset_id}' not found."
        )

    rec_col = get_recommendations_collection()
    recs = list(rec_col.find({"asset_id": asset_id}))
    for r in recs:
        r["_id"] = str(r["_id"])

    return ApiResponse(success=True, data=recs)


@router.post("/{asset_id}/reanalyze", response_model=ApiResponse[Dict[str, Any]])
def reanalyze_asset(asset_id: str):
    assets_col = get_assets_collection()
    asset = assets_col.find_one({"asset_id": asset_id})
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset '{asset_id}' not found."
        )

    # Locate saved file
    filename = asset.get("filename", "")
    extension = os.path.splitext(filename)[1].lower()
    
    # Check uploads directory for files matching asset hash or id
    candidate_files = [
        f for f in os.listdir(UPLOAD_DIR) 
        if f.endswith(extension)
    ]
    
    target_path = None
    for candidate in candidate_files:
        full_path = os.path.join(UPLOAD_DIR, candidate)
        try:
            h = calculate_file_hash(full_path)
            if h.get("hash") == asset.get("file_hash"):
                target_path = full_path
                break
        except Exception:
            continue

    if not target_path or not os.path.exists(target_path):
        # If specific file is not found, verify using existing record hash
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stored file for asset '{asset_id}' is not present in local storage enclave."
        )

    # Run the 7-layer verification pipeline
    integrity_result = calculate_file_hash(target_path)
    metadata_result = analyze_metadata(target_path)

    if extension == ".pdf":
        structure_result = analyze_pdf(target_path)
    elif extension == ".docx":
        structure_result = analyze_docx(target_path)
    elif extension in [".jpg", ".jpeg", ".png"]:
        structure_result = analyze_image(target_path)
    else:
        structure_result = {"score": 80, "message": "Text file structure is valid."}

    text_content = "" if extension in [".jpg", ".jpeg", ".png"] else structure_result.get("text", "")
    content_result = analyze_content(text_content)
    content_result["text"] = text_content

    pii_result = detect_pii(text_content)
    anomaly_result = detect_anomaly(content_result, metadata_result)
    risk_result = calculate_risk(
        integrity_result,
        metadata_result,
        structure_result,
        content_result,
        pii_result,
        anomaly_result
    )
    final_result = generate_trust_result(
        filename=filename,
        integrity=integrity_result,
        metadata=metadata_result,
        structure=structure_result,
        content=content_result,
        pii=pii_result,
        anomaly=anomaly_result,
        risk=risk_result
    )

    trust_score = float(final_result.get("trust_score", 50.0))
    risk_score = float(final_result.get("risk_score", 50.0))
    risk_level_str = final_result.get("risk_level", "Medium Risk")

    if "Low" in risk_level_str:
        asset_status = "VERIFIED"
    elif "Medium" in risk_level_str:
        asset_status = "UNDER REVIEW"
    elif "High" in risk_level_str:
        asset_status = "FLAGGED"
    else:
        asset_status = "REJECTED"

    now_iso = datetime.utcnow().isoformat()

    # Update asset in MongoDB
    assets_col.update_one(
        {"asset_id": asset_id},
        {
            "$set": {
                "trust_score": trust_score,
                "risk_level": risk_level_str,
                "status": asset_status,
                "updated_at": now_iso
            }
        }
    )

    # Update verification
    get_verifications_collection().update_one(
        {"asset_id": asset_id},
        {
            "$set": {
                "layer_1_file_integrity": integrity_result,
                "layer_2_metadata": metadata_result,
                "layer_3_structure": structure_result,
                "layer_4_content": content_result,
                "layer_5_privacy": pii_result,
                "layer_6_anomaly": anomaly_result,
                "layer_7_risk": risk_result,
                "verification_summary": final_result.get("verification_summary", {}),
                "updated_at": now_iso
            }
        },
        upsert=True
    )

    # Update trust_score
    get_trust_scores_collection().update_one(
        {"asset_id": asset_id},
        {
            "$set": {
                "trust_score": trust_score,
                "risk_score": risk_score,
                "risk_level": risk_level_str,
                "factors": risk_result.get("layer_scores", {}),
                "updated_at": now_iso
            }
        },
        upsert=True
    )

    # Audit log
    record_audit_log(
        action="ASSET_VERIFIED",
        entity_type="ASSET",
        entity_id=asset_id,
        user_id="SYSTEM",
        description=f"Asset {filename} re-analyzed. Trust score: {trust_score}/100 ({risk_level_str}).",
        result="CRITICAL" if "Critical" in risk_level_str else "WARNING" if "High" in risk_level_str else "SUCCESS"
    )

    return ApiResponse(
        success=True,
        data={
            "asset_id": asset_id,
            "trust_score": trust_score,
            "risk_score": risk_score,
            "risk_level": risk_level_str,
            "status": asset_status,
            "factors": risk_result.get("layer_scores", {}),
            "recommendation": final_result.get("recommendation")
        },
        message=f"Asset {asset_id} successfully re-analyzed."
    )
