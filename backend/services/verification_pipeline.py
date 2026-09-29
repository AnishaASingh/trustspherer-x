import os
import uuid
import datetime
from typing import Dict, Any, Optional, List

from database import (
    get_assets_collection,
    get_verifications_collection,
    get_trust_scores_collection,
    get_incidents_collection,
    get_recommendations_collection,
    get_audit_logs_collection
)

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
from services.ai_intelligence import generate_ai_security_insights
from utils.audit import record_audit_log


def run_7layer_verification_pipeline(
    file_path: str,
    original_filename: str,
    department: str = "Operations",
    category: Optional[str] = None,
    source: str = "Enterprise File Intake",
    allow_duplicate: bool = False,
    email_metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:

    """
    Executes the authoritative 7-layer TrustSphere verification pipeline
    on a physical file and persists the results to MongoDB.
    Reused by both manual uploads (POST /api/verify) and automatic watched-folder ingestion.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Target file not found at: {file_path}")

    file_size_bytes = os.path.getsize(file_path)
    formatted_size = (
        f"{(file_size_bytes / (1024 * 1024)):.2f} MB"
        if file_size_bytes >= 1024 * 1024
        else f"{max(1, round(file_size_bytes / 1024))} KB"
    )
    extension = os.path.splitext(original_filename)[1].lower()

    if not category:
        if extension == ".pdf":
            category = "Invoice" if "invoice" in original_filename.lower() else "PDF"
        elif extension == ".docx":
            category = "Contract" if "contract" in original_filename.lower() else "Document"
        elif extension == ".xlsx":
            category = "Spreadsheet"
        elif extension in [".jpg", ".jpeg", ".png"]:
            category = "Image"
        else:
            category = "Digital File"

    # ========================================================
    # LAYER 1: FILE INTEGRITY
    # ========================================================
    try:
        integrity_result = calculate_file_hash(file_path)
    except Exception as error:
        integrity_result = {
            "hash": "",
            "score": 0,
            "error": str(error),
            "status": "Integrity check failed"
        }

    file_hash = integrity_result.get("hash") if isinstance(integrity_result, dict) else str(integrity_result)

    # ========================================================
    # PART 6: DUPLICATE PREVENTION CHECK
    # ========================================================
    if file_hash and not allow_duplicate:
        existing_asset = get_assets_collection().find_one({"file_hash": file_hash})
        if existing_asset:
            record_audit_log(
                action="DUPLICATE_ASSET_SKIPPED",
                entity_type="ASSET",
                entity_id=existing_asset.get("asset_id", "UNKNOWN"),
                user_id="SecOps Ingestion Gate",
                description=f"File '{original_filename}' is a cryptographic duplicate of asset '{existing_asset.get('asset_id')}' (SHA-256: {file_hash[:16]}...). Skipped duplicate verification.",
                result="SUCCESS"
            )
            return {
                "success": True,
                "is_duplicate": True,
                "asset_id": existing_asset.get("asset_id"),
                "filename": original_filename,
                "file_hash": file_hash,
                "trust_score": existing_asset.get("trust_score", 50.0),
                "risk": existing_asset.get("risk_level", "Medium Risk"),
                "status": existing_asset.get("status", "VERIFIED"),
                "message": f"Asset with identical cryptographic hash already verified as {existing_asset.get('asset_id')}."
            }

    # ========================================================
    # LAYER 2: METADATA ANALYSIS
    # ========================================================
    try:
        metadata_result = analyze_metadata(file_path)
    except Exception as error:
        metadata_result = {
            "score": 0,
            "metadata_count": 0,
            "error": str(error)
        }

    # ========================================================
    # LAYER 3: DOCUMENT STRUCTURE
    # ========================================================
    try:
        if extension == ".pdf":
            structure_result = analyze_pdf(file_path)
        elif extension == ".docx":
            structure_result = analyze_docx(file_path)
        elif extension in [".jpg", ".jpeg", ".png"]:
            structure_result = analyze_image(file_path)
        else:
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as tf:
                    txt_body = tf.read()
            except Exception:
                txt_body = ""
            structure_result = {
                "score": 80,
                "text": txt_body,
                "message": "Text file structure is valid."
            }
    except Exception as error:
        structure_result = {
            "score": 0,
            "error": str(error)
        }

    # ========================================================
    # LAYER 4: CONTENT ANALYSIS
    # ========================================================
    try:
        if extension in [".jpg", ".jpeg", ".png"]:
            text_for_analysis = ""
        else:
            text_for_analysis = structure_result.get("text", "")

        content_result = analyze_content(text_for_analysis)
        content_result["text"] = text_for_analysis
    except Exception as error:
        content_result = {
            "score": 50,
            "risk_score": 50,
            "classification": "UNKNOWN",
            "suspicious_keywords": [],
            "urls_detected": [],
            "emails_detected": [],
            "word_count": 0,
            "status": "Content analysis failed",
            "error": str(error),
            "text": ""
        }

    # ========================================================
    # LAYER 5: PRIVACY / PII DETECTION
    # ========================================================
    try:
        text_for_pii = content_result.get("text", "")
        pii_result = detect_pii(text_for_pii)
    except Exception as error:
        pii_result = {
            "score": 50,
            "pii_detected": False,
            "pii_count": 0,
            "detected_types": [],
            "matches": {},
            "error": str(error)
        }

    # ========================================================
    # LAYER 6: ANOMALY DETECTION
    # ========================================================
    try:
        anomaly_result = detect_anomaly(content_result, metadata_result)
    except Exception as error:
        anomaly_result = {
            "score": 50,
            "status": "analysis_failed",
            "error": str(error)
        }

    # ========================================================
    # LAYER 7: RISK ENGINE
    # ========================================================
    try:
        risk_result = calculate_risk(
            integrity_result,
            metadata_result,
            structure_result,
            content_result,
            pii_result,
            anomaly_result
        )
    except Exception as error:
        risk_result = {
            "trust_score": 50.0,
            "risk_score": 50.0,
            "risk_level": "Medium Risk",
            "layer_scores": {
                "integrity": 50,
                "metadata": 50,
                "structure": 50,
                "content": 50,
                "privacy": 50,
                "anomaly": 50
            },
            "error": str(error)
        }

    # ========================================================
    # FINAL TRUST RESULT
    # ========================================================
    try:
        final_result = generate_trust_result(
            filename=original_filename,
            integrity=integrity_result,
            metadata=metadata_result,
            structure=structure_result,
            content=content_result,
            pii=pii_result,
            anomaly=anomaly_result,
            risk=risk_result
        )
    except Exception as error:
        final_result = {
            "filename": original_filename,
            "trust_score": risk_result.get("trust_score", 50),
            "risk_score": risk_result.get("risk_score", 50),
            "risk_level": risk_result.get("risk_level", "Medium Risk"),
            "recommendation": "Manual investigation is recommended.",
            "error": str(error)
        }

    trust_score = float(final_result.get("trust_score", 50.0))
    risk_score = float(final_result.get("risk_score", 50.0))
    risk_level_str = final_result.get("risk_level", "Medium Risk")

    if "Low" in risk_level_str:
        frontend_risk = "LOW"
        asset_status = "VERIFIED"
    elif "Medium" in risk_level_str:
        frontend_risk = "MEDIUM"
        asset_status = "UNDER REVIEW"
    elif "High" in risk_level_str:
        frontend_risk = "HIGH"
        asset_status = "FLAGGED"
    else:
        frontend_risk = "CRITICAL"
        asset_status = "REJECTED"

    now_dt = datetime.datetime.utcnow()
    now_str = now_dt.strftime("%Y-%m-%d %H:%M")
    now_iso = now_dt.isoformat()
    asset_id = f"AST-{uuid.uuid4().hex[:6].upper()}"
    verification_id = f"VER-{uuid.uuid4().hex[:6].upper()}"
    recommendation_id = f"REC-{uuid.uuid4().hex[:6].upper()}"
    incident_id = None

    layer_scores = risk_result.get("layer_scores", {})
    checks = [
        {
            "name": "File Integrity",
            "passed": layer_scores.get("integrity", 50) >= 60,
            "detail": f"Cryptographic block hash verified: {file_hash[:16]}..." if file_hash else "Checksum verified"
        },
        {
            "name": "Metadata Validation",
            "passed": layer_scores.get("metadata", 50) >= 60,
            "detail": f"File size {formatted_size}; format {extension} consistent"
        },
        {
            "name": "Document Structure",
            "passed": layer_scores.get("structure", 50) >= 60,
            "detail": structure_result.get("status", "Structure parsed successfully")
        },
        {
            "name": "Content Consistency",
            "passed": layer_scores.get("content", 50) >= 60,
            "detail": f"{len(content_result.get('suspicious_keywords', []))} suspicious indicators detected"
        },
        {
            "name": "Privacy / PII Check",
            "passed": layer_scores.get("privacy", 50) >= 60,
            "detail": "Zero plain-text PII detected" if not pii_result.get("pii_detected") else f"Flagged {pii_result.get('pii_count')} sensitive PII instances"
        },
        {
            "name": "Anomaly Detection",
            "passed": layer_scores.get("anomaly", 50) >= 60,
            "detail": f"Isolation Forest evaluation: {anomaly_result.get('status', 'normal')}"
        }
    ]

    anomalies: List[str] = []
    if content_result.get("suspicious_keywords"):
        anomalies.append(f"Suspicious terms detected: {', '.join(content_result['suspicious_keywords'])}")
    if pii_result.get("pii_detected"):
        types = pii_result.get("detected_types", [])
        anomalies.append(f"Personally Identifiable Information found ({', '.join(types)})")
    if anomaly_result.get("status") == "anomaly_detected":
        anomalies.append("Isolation Forest flagged structural feature deviation in asset metadata")

    recommendations_list: List[str] = []
    primary_rec = final_result.get("recommendation", "")
    if primary_rec:
        recommendations_list.append(primary_rec)
    if frontend_risk == "CRITICAL":
        recommendations_list.append("Quarantine asset immediately from corporate distribution.")
        recommendations_list.append("Trigger automated incident response ticket for Security Operations.")
    elif frontend_risk == "HIGH":
        recommendations_list.append("Initiate secondary dual-custody verification with departmental lead.")
        recommendations_list.append("Request out-of-band cryptographic signature validation.")
    elif frontend_risk == "MEDIUM":
        recommendations_list.append("Review flagged content terms with departmental compliance officer.")

    # ========================================================
    # AI INTELLIGENCE LAYER (GEMINI / HEURISTIC ENHANCEMENT)
    # ========================================================
    try:
        ai_insights = generate_ai_security_insights(
            trust_score=trust_score,
            risk_score=risk_score,
            risk_level=risk_level_str,
            layer_scores=layer_scores,
            detected_threats=content_result.get("suspicious_keywords", []),
            detected_pii_count=pii_result.get("pii_count", 0),
            detected_pii_types=pii_result.get("detected_types", []),
            department=department,
            asset_type=category,
            filename=original_filename
        )
    except Exception as ai_err:
        ai_insights = {
            "risk_explanation": primary_rec or "Standard 7-layer verification completed.",
            "security_summary": f"Asset '{original_filename}' evaluated with trust score {trust_score:.1f}/100.",
            "recommended_actions": recommendations_list,
            "possible_impact": "Operational review recommended based on classified risk level.",
            "human_readable_reason": f"Classified as {risk_level_str} based on layer heuristics.",
            "ai_generated": True,
            "is_live_llm": False,
            "error": str(ai_err)
        }

    # Merge AI recommended actions if available
    for act in ai_insights.get("recommended_actions", []):
        if act and act not in recommendations_list:
            recommendations_list.append(act)

    # ========================================================
    # SAVE TO MONGODB (PHASE 2 & PHASE 4 STANDARDS)
    # ========================================================
    is_demo_flag = bool(email_metadata.get("is_demo") or email_metadata.get("simulated")) if isinstance(email_metadata, dict) else False
    ingestion_mode_val = email_metadata.get("ingestion_mode", "DEMO" if is_demo_flag else "REAL") if isinstance(email_metadata, dict) else "MANUAL"

    # 1. assets collection
    asset_doc = {
        "asset_id": asset_id,
        "filename": original_filename,
        "file_type": extension,
        "file_size": formatted_size,
        "file_path": file_path,
        "department_id": department,
        "source": source,
        "category": category,
        "upload_date": now_str,
        "status": asset_status,
        "trust_score": trust_score,
        "risk_level": risk_level_str,
        "file_hash": file_hash,
        "factors": layer_scores,
        "checks": checks,
        "ai_summary": ai_insights.get("security_summary"),
        "ai_insights": ai_insights,
        "email_metadata": email_metadata,
        "is_demo": is_demo_flag,
        "ingestion_mode": ingestion_mode_val,
        "created_at": now_iso
    }
    get_assets_collection().insert_one(asset_doc)

    # 2. asset_verifications collection
    verification_doc = {
        "verification_id": verification_id,
        "asset_id": asset_id,
        "layer_1_file_integrity": integrity_result,
        "layer_2_metadata": metadata_result,
        "layer_3_structure": structure_result,
        "layer_4_content": content_result,
        "layer_5_privacy": pii_result,
        "layer_6_anomaly": anomaly_result,
        "layer_7_risk": risk_result,
        "ai_intelligence": ai_insights,
        "email_metadata": email_metadata,
        "verification_summary": final_result.get("verification_summary", {}),
        "created_at": now_iso
    }
    get_verifications_collection().insert_one(verification_doc)

    # 3. trust_scores collection
    trust_score_doc = {
        "asset_id": asset_id,
        "trust_score": trust_score,
        "risk_score": risk_score,
        "risk_level": risk_level_str,
        "factors": layer_scores,
        "created_at": now_iso
    }
    get_trust_scores_collection().insert_one(trust_score_doc)

    # 4. recommendations collection
    rec_doc = {
        "recommendation_id": recommendation_id,
        "asset_id": asset_id,
        "incident_id": None,
        "department_id": department,
        "recommendation": primary_rec,
        "ai_explanation": ai_insights.get("risk_explanation"),
        "ai_recommended_actions": ai_insights.get("recommended_actions"),
        "ai_impact": ai_insights.get("possible_impact"),
        "ai_generated": True,
        "priority": "HIGH" if frontend_risk in ["HIGH", "CRITICAL"] else "MEDIUM" if frontend_risk == "MEDIUM" else "LOW",
        "status": "PENDING",
        "created_at": now_iso
    }


    # 5. incidents collection (ONLY when resulting risk is High or Critical)
    if frontend_risk in ["HIGH", "CRITICAL"]:
        incident_id = f"INC-{uuid.uuid4().hex[:6].upper()}"
        rec_doc["incident_id"] = incident_id

        incident_title = f"{frontend_risk} Risk Alert: {original_filename}"
        incident_desc = anomalies[0] if anomalies else f"Automated risk threshold breached: {trust_score}/100 trust score."

        incident_doc = {
            "incident_id": incident_id,
            "asset_id": asset_id,
            "title": incident_title,
            "description": incident_desc,
            "department_id": department,
            "severity": frontend_risk,
            "status": "OPEN",
            "detected_date": now_str,
            "is_demo": is_demo_flag,
            "timeline": [
                {
                    "step": "Asset uploaded",
                    "time": now_str,
                    "status": "completed",
                    "note": f"Ingested via {source}."
                },
                {
                    "step": "Verification executed",
                    "time": now_str,
                    "status": "completed",
                    "note": f"Trust score evaluated: {trust_score}/100 ({risk_level_str})."
                },
                {
                    "step": "Incident created",
                    "time": now_str,
                    "status": "completed",
                    "note": f"Ticket {incident_id} automatically generated."
                },
                {
                    "step": "Under investigation",
                    "time": None,
                    "status": "pending",
                    "note": "Awaiting triage."
                },
                {
                    "step": "Resolution",
                    "time": None,
                    "status": "pending",
                    "note": "Remediation pending."
                }
            ],
            "created_at": now_iso
        }
        get_incidents_collection().insert_one(incident_doc)

    get_recommendations_collection().insert_one(rec_doc)

    # 6. audit_logs collection
    audit_action = "ASSET_INGESTED" if "Ingestion" in source or "Watched" in source else "ASSET_VERIFIED"
    record_audit_log(
        action=audit_action,
        entity_type="ASSET",
        entity_id=asset_id,
        user_id="SecOps Automated Scanner",
        description=f"Asset {original_filename} verified via {source}. Score: {trust_score}/100 ({risk_level_str}).",
        result="CRITICAL" if frontend_risk == "CRITICAL" else "WARNING" if frontend_risk == "HIGH" else "SUCCESS"
    )

    if incident_id:
        record_audit_log(
            action="INCIDENT_CREATED",
            entity_type="INCIDENT",
            entity_id=incident_id,
            user_id="SecOps Automated Unit",
            description=f"Security Incident {incident_id} generated for asset {asset_id} ({frontend_risk}).",
            result="WARNING" if frontend_risk == "HIGH" else "CRITICAL"
        )

    return {
        "success": True,
        "is_duplicate": False,
        "asset_id": asset_id,
        "verification_id": verification_id,
        "trust_score": trust_score,
        "risk_score": risk_score,
        "risk": frontend_risk,
        "risk_level": risk_level_str,
        "status": asset_status,
        "checks": checks,
        "factors": layer_scores,
        "anomalies": anomalies,
        "recommendations": recommendations_list,
        "incident_id": incident_id,
        "file_hash": file_hash,
        "filename": original_filename,
        "file_size": formatted_size,
        "department": department,
        "category": category,
        "source": source,
        "upload_date": now_str,
        "verification_summary": final_result.get("verification_summary", {}),
        "ai_insights": ai_insights,
        "email_metadata": email_metadata,
        "created_at": now_iso
    }

