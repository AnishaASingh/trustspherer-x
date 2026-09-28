import os
import json
import logging
import httpx
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

from database import (
    get_assets_collection,
    get_verifications_collection,
    get_trust_scores_collection,
    get_incidents_collection,
    get_recommendations_collection,
    get_departments_collection,
    get_employees_collection,
    get_audit_logs_collection
)

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
logger = logging.getLogger("trustsphere.ai_intelligence")

GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b"

# ============================================================
# CONTROLLED TRUSTSPHERE SYSTEM PROMPT
# ============================================================
TRUSTSPHERE_SYSTEM_PROMPT = """You are the TrustSphere Enterprise Decision Trust Intelligence AI Analyst.
You operate inside TrustSphere, an enterprise security platform that evaluates digital assets across a 7-layer deterministic verification pipeline and an Isolation Forest anomaly detection engine.

Core Domain Concepts You Understand:
- Digital Asset: Any ingested document, invoice, contract, image, or email payload tracked in TrustSphere.
- Trust Score (0-100): Deterministic weighted score computed by the TrustSphere engine (higher = more trustworthy).
- Risk Level: Classification derived from Trust Score (LOW, MEDIUM, HIGH, CRITICAL).
- Layer Scores: Integrity Score (SHA-256 & structure), Metadata Score, Structure Score, Content Score (phishing/keyword heuristics), Privacy/PII Score, and Anomaly Score (Isolation Forest).
- PII Findings: Exposed sensitive data (Aadhaar, PAN, Credit Cards, Emails, Phone numbers, IP addresses).
- Incident: Security ticket created when an asset exhibits HIGH or CRITICAL risk.
- Recommendation: Actionable containment or governance step.
- Department & Employee: Organizational entities mapped in the Digital Twin.
- Digital Twin: Live organizational graph reflecting departments, employees, assets, trust scores, and incidents.
- Audit Log: Immutable record of security events.

Strict Epistemic Rules:
1. You DO NOT replace the deterministic TrustSphere risk engine or invent database records.
2. You MUST distinguish clearly between:
   - FACTS: Directly obtained from the supplied TrustSphere database records and verification calculations.
   - INFERENCES: Reasonable security conclusions deduced from those facts.
   - RECOMMENDATIONS: Practical, actionable remediation steps for the administrator or SOC team.
3. If requested information is unavailable in the supplied TrustSphere context, explicitly state that it is unavailable rather than guessing or fabricating records.
4. Keep every array item concise (1 short sentence each, maximum 2-3 items per array) and always return strictly valid, complete JSON matching the requested schema.
"""


def _get_groq_config() -> Dict[str, str]:
    api_key = os.environ.get("GROQ_API_KEY")
    if api_key is None:
        load_dotenv()
        api_key = os.environ.get("GROQ_API_KEY", "")
    api_key = api_key.strip()
    model = os.environ.get("GROQ_MODEL", DEFAULT_GROQ_MODEL).strip() or DEFAULT_GROQ_MODEL
    return {"api_key": api_key, "model": model}


def get_ai_status() -> Dict[str, Any]:
    """Returns AI module configuration and availability status without exposing credentials."""
    cfg = _get_groq_config()
    has_key = bool(cfg["api_key"])
    masked_key = ""
    if has_key:
        raw_key = cfg["api_key"]
        masked_key = f"{raw_key[:6]}...{raw_key[-4:]}" if len(raw_key) > 10 else "***configured***"

    return {
        "provider": "Groq",
        "api_base": "https://api.groq.com/openai/v1",
        "configured": has_key,
        "is_configured": has_key,
        "live_llm_enabled": has_key,
        "masked_key": masked_key,
        "model": cfg["model"],
        "model_used": cfg["model"],
        "status": f"Ready (Groq {cfg['model']})" if has_key else "Standby (Rule-based Fallback Active)",
        "fallback_ready": True
    }


def _normalize_risk_label(risk_level: str) -> str:
    lvl = str(risk_level or "MEDIUM").upper()
    if "CRITICAL" in lvl:
        return "CRITICAL"
    if "HIGH" in lvl:
        return "HIGH"
    if "LOW" in lvl:
        return "LOW"
    return "MEDIUM"


def _validate_and_normalize_ai_response(
    parsed: Dict[str, Any],
    default_risk: str,
    model_name: str,
    is_live: bool = True,
    provider: str = "Groq"
) -> Dict[str, Any]:
    """
    Validates the structured AI response and guarantees both the new standardized schema
    (summary, risk_level, key_findings, reasoning, recommendations, facts, inferences)
    and backward-compatible keys (security_summary, risk_explanation, recommended_actions,
    possible_impact, human_readable_reason).
    """
    if not isinstance(parsed, dict):
        raise ValueError("AI response is not a JSON object.")

    summary = str(parsed.get("summary") or parsed.get("security_summary") or "").strip()
    if not summary:
        raise ValueError("Missing 'summary' in AI response.")

    risk_level = _normalize_risk_label(parsed.get("risk_level") or default_risk)

    key_findings = parsed.get("key_findings")
    if not isinstance(key_findings, list) or not key_findings:
        key_findings = parsed.get("facts") if isinstance(parsed.get("facts"), list) and parsed.get("facts") else [summary]
    key_findings = [str(item).strip() for item in key_findings if str(item).strip()]

    reasoning = parsed.get("reasoning")
    if not isinstance(reasoning, list) or not reasoning:
        raw_expl = parsed.get("risk_explanation") or parsed.get("human_readable_reason") or summary
        reasoning = [str(raw_expl).strip()]
    reasoning = [str(item).strip() for item in reasoning if str(item).strip()]

    recommendations = parsed.get("recommendations") or parsed.get("recommended_actions")
    if not isinstance(recommendations, list) or not recommendations:
        recommendations = ["Review verification telemetry and confirm sender authenticity."]
    recommendations = [str(item).strip() for item in recommendations if str(item).strip()]

    facts = parsed.get("facts")
    if not isinstance(facts, list) or not facts:
        facts = key_findings
    facts = [str(item).strip() for item in facts if str(item).strip()]

    inferences = parsed.get("inferences")
    if not isinstance(inferences, list) or not inferences:
        inferences = reasoning
    inferences = [str(item).strip() for item in inferences if str(item).strip()]

    possible_impact = str(
        parsed.get("possible_impact")
        or (inferences[0] if inferences else "Potential operational or compliance risk if unverified.")
    ).strip()

    human_readable_reason = str(
        parsed.get("human_readable_reason")
        or (reasoning[0] if reasoning else summary)
    ).strip()

    risk_explanation = str(
        parsed.get("risk_explanation")
        or " ".join(reasoning)
    ).strip()

    return {
        "summary": summary,
        "risk_level": risk_level,
        "key_findings": key_findings,
        "reasoning": reasoning,
        "recommendations": recommendations,
        "facts": facts,
        "inferences": inferences,
        # Backward compatibility fields for existing UI components
        "security_summary": summary,
        "risk_explanation": risk_explanation,
        "recommended_actions": recommendations,
        "possible_impact": possible_impact,
        "human_readable_reason": human_readable_reason,
        "ai_generated": True,
        "is_live_llm": is_live,
        "provider": provider,
        "model": model_name,
        "model_used": model_name
    }


def _extract_json_dict(raw_text: str) -> Dict[str, Any]:
    """Safely extracts and parses a JSON object from model output (even if wrapped in markdown fences)."""
    text = (raw_text or "").strip()
    if text.startswith("```"):
        import re
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]
    return json.loads(text)


def _call_groq_json(system_prompt: str, user_prompt: str, timeout: float = 35.0) -> Dict[str, Any]:
    """
    Calls Groq's OpenAI-compatible chat completions endpoint with JSON response format.
    Uses reasoning_effort="low" for fast, compact JSON generation on openai/gpt-oss-20b,
    handles Groq on_demand TPM rate limits (HTTP 429) with automatic backoff retry,
    and handles HTTP 400 failed_generation cleanly.
    Never logs or exposes the API key.
    """
    import time
    cfg = _get_groq_config()
    api_key = cfg["api_key"]
    model = cfg["model"]

    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured in environment.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "response_format": {"type": "json_object"},
        "reasoning_effort": "low",
        "temperature": 0.1,
        "max_tokens": 1200
    }

    with httpx.Client(timeout=timeout) as client:
        resp = client.post(GROQ_BASE_URL, headers=headers, json=payload)

        # Handle Groq 8,000 TPM on_demand rate limit with automatic backoff retry
        for wait_sec in (5.0, 8.0, 10.0):
            if resp.status_code != 429:
                break
            time.sleep(wait_sec)
            resp = client.post(GROQ_BASE_URL, headers=headers, json=payload)

        # If Groq strict json_object mode rejected output or reasoning_effort unsupported, retry without response_format
        if resp.status_code == 400:
            try:
                err_json = resp.json()
                failed_gen = err_json.get("error", {}).get("failed_generation", "")
                if failed_gen:
                    try:
                        return _extract_json_dict(failed_gen)
                    except Exception:
                        pass
            except Exception:
                pass

            fallback_payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt + "\nIMPORTANT: Output ONLY raw JSON starting with { and ending with }. Do not wrap in markdown code blocks."},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.1,
                "max_tokens": 1200
            }
            resp = client.post(GROQ_BASE_URL, headers=headers, json=fallback_payload)
            for wait_sec in (5.0, 8.0):
                if resp.status_code != 429:
                    break
                time.sleep(wait_sec)
                resp = client.post(GROQ_BASE_URL, headers=headers, json=fallback_payload)

    if resp.status_code != 200:
        safe_err = f"Groq API returned HTTP {resp.status_code}"
        try:
            err_json = resp.json()
            err_msg = err_json.get("error", {}).get("message", "")
            if err_msg:
                safe_err = f"{safe_err}: {err_msg[:200]}"
        except Exception:
            pass
        raise RuntimeError(safe_err)

    data = resp.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
    return _extract_json_dict(content)


def generate_fallback_ai_insights(
    trust_score: float,
    risk_score: float,
    risk_level: str,
    layer_scores: Dict[str, Any],
    detected_threats: List[str],
    detected_pii_count: int,
    detected_pii_types: List[str],
    department: str,
    asset_type: str,
    filename: str
) -> Dict[str, Any]:
    """
    Deterministic rule-based SOC intelligence fallback engine.
    Ensures TrustSphere continues to produce comprehensive structured explanations
    even when Groq API is unconfigured, offline, or rate-limited.
    """
    norm_risk = _normalize_risk_label(risk_level)
    is_high_or_critical = norm_risk in ("HIGH", "CRITICAL")

    facts = [
        f"FACT: Asset '{filename}' ({asset_type}) in department '{department}' has a deterministic Trust Score of {trust_score:.1f}/100 and Risk Score of {risk_score:.1f}/100 ({norm_risk}).",
        f"FACT: Layer scores — Integrity: {layer_scores.get('integrity', 50)}, Metadata: {layer_scores.get('metadata', 50)}, Structure: {layer_scores.get('structure', 50)}, Content: {layer_scores.get('content', 50)}, Privacy: {layer_scores.get('privacy', 50)}, Anomaly: {layer_scores.get('anomaly', 50)}."
    ]
    if detected_pii_count > 0:
        facts.append(f"FACT: Detected {detected_pii_count} PII instance(s) of type(s): {', '.join(detected_pii_types) if detected_pii_types else 'sensitive data'}.")
    if detected_threats:
        facts.append(f"FACT: Content inspection flagged suspicious keywords: {', '.join(detected_threats[:5])}.")

    inferences = []
    if layer_scores.get("integrity", 100) < 60:
        inferences.append("INFERENCE: Cryptographic or structural integrity score below 60 indicates potential file tampering or header corruption.")
    if detected_pii_count > 0:
        inferences.append("INFERENCE: Presence of unredacted PII increases regulatory and data-exposure risk within the department.")
    if detected_threats:
        inferences.append("INFERENCE: Suspicious lexical patterns suggest potential social engineering or phishing lure content.")
    if layer_scores.get("anomaly", 100) < 60:
        inferences.append("INFERENCE: Isolation Forest anomaly score indicates statistical deviation from normal enterprise documents.")
    if not inferences:
        inferences.append("INFERENCE: All 7 verification layers align with normal enterprise document baselines.")

    if is_high_or_critical:
        summary = (
            f"ELEVATED RISK ASSET: '{filename}' ({asset_type}) in {department} scored {trust_score:.1f}/100 ({norm_risk} risk). "
            f"Immediate review and containment recommended."
        )
    elif norm_risk == "MEDIUM":
        summary = (
            f"CONDITIONAL TRUST: '{filename}' ({asset_type}) in {department} scored {trust_score:.1f}/100 (MEDIUM risk) "
            f"with minor compliance or metadata deviations."
        )
    else:
        summary = (
            f"TRUSTED ASSET: '{filename}' ({asset_type}) passed all 7 verification layers with a Trust Score of {trust_score:.1f}/100 (LOW risk)."
        )

    recommendations = []
    if is_high_or_critical:
        recommendations.append(f"Isolate '{filename}' from general {department} shared drives pending SOC review.")
        if detected_pii_count > 0:
            recommendations.append("Redact or encrypt exposed PII fields before archival or distribution.")
        recommendations.append("Verify sender provenance through out-of-band confirmation.")
    elif norm_risk == "MEDIUM":
        recommendations.append(f"Confirm document origin with the {department} owner.")
        if detected_pii_count > 0:
            recommendations.append("Ensure PII handling complies with internal data governance policy.")
    else:
        recommendations.append(f"Approve '{filename}' for standard operational workflow in {department}.")
        recommendations.append("Retain SHA-256 verification record in the audit trail.")

    raw_fallback = {
        "summary": summary,
        "risk_level": norm_risk,
        "key_findings": facts,
        "reasoning": inferences,
        "recommendations": recommendations,
        "facts": facts,
        "inferences": inferences,
        "possible_impact": inferences[0],
        "human_readable_reason": summary
    }
    return _validate_and_normalize_ai_response(
        raw_fallback,
        default_risk=norm_risk,
        model_name="rule-based-fallback",
        is_live=False,
        provider="TrustSphere Heuristic Intelligence"
    )


def generate_ai_security_insights(
    trust_score: float,
    risk_score: float,
    risk_level: str,
    layer_scores: Dict[str, Any],
    detected_threats: List[str],
    detected_pii_count: int,
    detected_pii_types: List[str],
    department: str = "Operations",
    asset_type: str = "Document",
    filename: str = "Unknown Asset"
) -> Dict[str, Any]:
    """
    Main entrypoint for pipeline AI intelligence.
    Invokes Groq (openai/gpt-oss-20b) using sanitized verification findings.
    Falls back gracefully to the deterministic heuristic engine if Groq is unavailable.
    """
    cfg = _get_groq_config()
    norm_risk = _normalize_risk_label(risk_level)

    if not cfg["api_key"]:
        logger.info("GROQ_API_KEY not configured. Using TrustSphere heuristic intelligence engine.")
        return generate_fallback_ai_insights(
            trust_score, risk_score, risk_level, layer_scores,
            detected_threats, detected_pii_count, detected_pii_types,
            department, asset_type, filename
        )

    sanitized_context = {
        "asset_filename": filename,
        "asset_category": asset_type,
        "department": department,
        "trust_score": round(float(trust_score), 2),
        "risk_score": round(float(risk_score), 2),
        "risk_level": norm_risk,
        "layer_scores": {
            "integrity_score": layer_scores.get("integrity", 50),
            "metadata_score": layer_scores.get("metadata", 50),
            "structure_score": layer_scores.get("structure", 50),
            "content_score": layer_scores.get("content", 50),
            "privacy_pii_score": layer_scores.get("privacy", 50),
            "isolation_forest_anomaly_score": layer_scores.get("anomaly", 50)
        },
        "suspicious_keywords_detected": detected_threats,
        "pii_findings_count": detected_pii_count,
        "pii_types_detected": detected_pii_types
    }

    user_prompt = f"""Analyze the following verified TrustSphere asset security telemetry:

{json.dumps(sanitized_context, indent=2)}

Return a valid JSON object with EXACTLY these fields:
{{
  "summary": "2-sentence executive security summary explaining the asset's trust and risk status.",
  "risk_level": "{norm_risk}",
  "key_findings": [
    "FACT: ...",
    "FACT: ..."
  ],
  "reasoning": [
    "INFERENCE: ...",
    "INFERENCE: ..."
  ],
  "recommendations": [
    "Practical action 1",
    "Practical action 2",
    "Practical action 3"
  ],
  "facts": [
    "Direct fact from telemetry 1",
    "Direct fact from telemetry 2"
  ],
  "inferences": [
    "Reasoned security conclusion 1",
    "Reasoned security conclusion 2"
  ],
  "possible_impact": "1-sentence operational or compliance impact if mishandled.",
  "human_readable_reason": "1-sentence plain-English reason for this classification."
}}"""

    try:
        parsed = _call_groq_json(TRUSTSPHERE_SYSTEM_PROMPT, user_prompt)
        result = _validate_and_normalize_ai_response(
            parsed,
            default_risk=norm_risk,
            model_name=cfg["model"],
            is_live=True,
            provider="Groq"
        )
        logger.info(f"Generated Groq AI analysis ({cfg['model']}) for asset '{filename}'.")
        return result
    except Exception as exc:
        logger.warning(f"Groq AI call failed ({exc}). Falling back to rule-based intelligence.")
        fallback = generate_fallback_ai_insights(
            trust_score, risk_score, risk_level, layer_scores,
            detected_threats, detected_pii_count, detected_pii_types,
            department, asset_type, filename
        )
        fallback["fallback_reason"] = str(exc)
        return fallback


# ============================================================
# ON-DEMAND ENDPOINT HANDLERS (ASSET / INCIDENT / TWIN / CHAT)
# ============================================================

def analyze_asset_by_id(asset_id: str) -> Dict[str, Any]:
    """
    Fetches sanitized asset, verification, and incident context from MongoDB
    and runs Groq AI security finding explanation & risk analysis.
    """
    asset = get_assets_collection().find_one({"asset_id": asset_id}, {"_id": 0})
    if not asset:
        raise ValueError(f"Asset '{asset_id}' not found in TrustSphere database.")

    verification = get_verifications_collection().find_one({"asset_id": asset_id}, {"_id": 0}) or {}
    trust_doc = get_trust_scores_collection().find_one({"asset_id": asset_id}, {"_id": 0}) or {}
    incidents = list(get_incidents_collection().find({"asset_id": asset_id}, {"_id": 0, "timeline": 0}).limit(5))

    layer_scores = asset.get("factors") or trust_doc.get("factors") or {
        "integrity": verification.get("integrity", {}).get("score", 80),
        "metadata": verification.get("metadata", {}).get("score", 80),
        "structure": verification.get("structure", {}).get("score", 80),
        "content": verification.get("content", {}).get("score", 80),
        "privacy": verification.get("pii", {}).get("score", 80),
        "anomaly": verification.get("anomaly", {}).get("score", 80)
    }

    content_info = verification.get("content", {}) if isinstance(verification.get("content"), dict) else {}
    pii_info = verification.get("pii", {}) if isinstance(verification.get("pii"), dict) else {}

    detected_threats = content_info.get("suspicious_keywords", []) or asset.get("anomalies", [])
    pii_count = int(pii_info.get("pii_count", 0))
    pii_types = pii_info.get("detected_types", [])

    ai_result = generate_ai_security_insights(
        trust_score=float(asset.get("trust_score", 50.0)),
        risk_score=float(asset.get("risk_score", 100.0 - float(asset.get("trust_score", 50.0)))),
        risk_level=str(asset.get("risk_level") or asset.get("risk") or "MEDIUM"),
        layer_scores=layer_scores,
        detected_threats=detected_threats,
        detected_pii_count=pii_count,
        detected_pii_types=pii_types,
        department=str(asset.get("department_id") or asset.get("department") or "Operations"),
        asset_type=str(asset.get("asset_type") or asset.get("category") or "Document"),
        filename=str(asset.get("filename") or asset.get("name") or asset_id)
    )

    ai_result["asset_id"] = asset_id
    ai_result["related_incidents_count"] = len(incidents)

    # Persist updated AI insights on the asset document
    get_assets_collection().update_one(
        {"asset_id": asset_id},
        {"$set": {"ai_insights": ai_result, "ai_summary": ai_result.get("summary")}}
    )
    return ai_result


def analyze_incident_by_id(incident_id: str) -> Dict[str, Any]:
    """
    Analyzes a specific TrustSphere security incident using Groq AI.
    Explains why the incident was created and what the organization should investigate.
    """
    inc = get_incidents_collection().find_one({"incident_id": incident_id}, {"_id": 0})
    if not inc:
        raise ValueError(f"Incident '{incident_id}' not found in TrustSphere database.")

    asset_id = inc.get("asset_id")
    asset = get_assets_collection().find_one({"asset_id": asset_id}, {"_id": 0, "ai_insights": 0}) if asset_id else {}
    verification = get_verifications_collection().find_one({"asset_id": asset_id}, {"_id": 0}) if asset_id else {}

    sanitized_incident_context = {
        "incident_id": inc.get("incident_id"),
        "title": inc.get("title") or inc.get("issue_type"),
        "severity": inc.get("severity", "HIGH"),
        "status": inc.get("status", "OPEN"),
        "department": inc.get("department_id") or inc.get("department"),
        "description": inc.get("description"),
        "detected_date": inc.get("detected_date") or inc.get("created_at"),
        "related_asset": {
            "asset_id": asset.get("asset_id") if asset else asset_id,
            "filename": asset.get("filename") if asset else inc.get("asset_name"),
            "trust_score": asset.get("trust_score") if asset else inc.get("trust_score"),
            "risk_level": asset.get("risk_level") if asset else inc.get("severity"),
            "source": asset.get("source") if asset else "Unknown",
            "anomalies": asset.get("anomalies", []) if asset else [],
            "suspicious_keywords": (verification.get("content", {}) or {}).get("suspicious_keywords", []) if verification else [],
            "pii_types": (verification.get("pii", {}) or {}).get("detected_types", []) if verification else []
        }
    }

    norm_risk = _normalize_risk_label(inc.get("severity", "HIGH"))
    cfg = _get_groq_config()

    user_prompt = f"""Analyze the following TrustSphere security incident and explain why it was triggered and what the organization should investigate:

{json.dumps(sanitized_incident_context, indent=2)}

Return a valid JSON object with EXACTLY these fields:
{{
  "summary": "Clear explanation of why incident {incident_id} was created and its current urgency.",
  "risk_level": "{norm_risk}",
  "key_findings": [
    "FACT: ...",
    "FACT: ..."
  ],
  "reasoning": [
    "INFERENCE: ...",
    "INFERENCE: ..."
  ],
  "recommendations": [
    "Investigation step 1",
    "Containment action 2",
    "Governance action 3"
  ],
  "facts": [
    "Fact directly from incident/asset record"
  ],
  "inferences": [
    "Analytical inference about root cause or exposure"
  ],
  "possible_impact": "Potential organizational impact if left unresolved."
}}"""

    try:
        parsed = _call_groq_json(TRUSTSPHERE_SYSTEM_PROMPT, user_prompt)
        result = _validate_and_normalize_ai_response(
            parsed,
            default_risk=norm_risk,
            model_name=cfg["model"],
            is_live=True,
            provider="Groq"
        )
        result["incident_id"] = incident_id
        result["asset_id"] = asset_id
        return result
    except Exception as exc:
        logger.warning(f"Groq incident analysis failed ({exc}). Using deterministic fallback.")
        facts = [
            f"FACT: Incident '{incident_id}' has severity '{inc.get('severity', 'HIGH')}' and status '{inc.get('status', 'OPEN')}' in department '{inc.get('department_id', 'Unknown')}'.",
            f"FACT: Associated asset '{asset_id}' recorded a Trust Score of {inc.get('trust_score', 'N/A')}/100.",
            f"FACT: Trigger description — {inc.get('description', 'Threshold violation detected by verification pipeline.')}"
        ]
        inferences = [
            "INFERENCE: The asset violated enterprise trust thresholds due to content threats, PII exposure, or structural anomalies.",
            f"INFERENCE: Department '{inc.get('department_id', 'Operations')}' requires immediate triage to prevent downstream propagation."
        ]
        recs = [
            f"Investigate the origin and sender of asset '{asset_id}'.",
            "Review verification layer logs for exposed PII or suspicious URLs/keywords.",
            "Transition incident status to INVESTIGATING and document containment findings."
        ]
        fallback = _validate_and_normalize_ai_response(
            {
                "summary": f"Incident {incident_id} ({inc.get('severity', 'HIGH')}) was triggered for asset {asset_id} in {inc.get('department_id', 'Operations')}. {inc.get('description', '')}",
                "risk_level": norm_risk,
                "key_findings": facts,
                "reasoning": inferences,
                "recommendations": recs,
                "facts": facts,
                "inferences": inferences
            },
            default_risk=norm_risk,
            model_name="rule-based-fallback",
            is_live=False,
            provider="TrustSphere Heuristic Intelligence"
        )
        fallback["incident_id"] = incident_id
        fallback["asset_id"] = asset_id
        fallback["fallback_reason"] = str(exc)
        return fallback


def analyze_digital_twin_state() -> Dict[str, Any]:
    """
    Analyzes the current Digital Twin state across departments, employees, assets, and incidents.
    Identifies high-risk assets, affected departments, important incidents, unusual patterns,
    and areas requiring attention.
    """
    depts = list(get_departments_collection().find({}, {"_id": 0}))
    assets = list(get_assets_collection().find({}, {"_id": 0, "ai_insights": 0}).sort("created_at", -1).limit(100))
    incidents = list(get_incidents_collection().find({}, {"_id": 0, "timeline": 0}).sort("created_at", -1).limit(50))
    total_employees = get_employees_collection().count_documents({})

    # Compute department-level telemetry
    dept_stats = []
    for d in depts:
        d_name = d.get("name", "Unknown")
        d_assets = [a for a in assets if str(a.get("department_id", "")).lower() == d_name.lower()]
        d_incs = [i for i in incidents if str(i.get("department_id", "")).lower() == d_name.lower()]
        open_incs = [i for i in d_incs if str(i.get("status", "")).upper() in ("OPEN", "INVESTIGATING")]
        avg_trust = round(sum(float(a.get("trust_score", 80.0)) for a in d_assets) / len(d_assets), 1) if d_assets else 100.0
        dept_stats.append({
            "department": d_name,
            "asset_count": len(d_assets),
            "incident_count": len(d_incs),
            "open_incident_count": len(open_incs),
            "average_trust_score": avg_trust
        })

    high_risk_assets = [
        {
            "asset_id": a.get("asset_id"),
            "filename": a.get("filename"),
            "department": a.get("department_id"),
            "trust_score": a.get("trust_score"),
            "risk_level": a.get("risk_level") or a.get("risk"),
            "source": a.get("source")
        }
        for a in assets
        if _normalize_risk_label(a.get("risk_level") or a.get("risk")) in ("HIGH", "CRITICAL")
    ][:10]

    open_incidents = [
        {
            "incident_id": i.get("incident_id"),
            "title": i.get("title") or i.get("issue_type"),
            "severity": i.get("severity"),
            "status": i.get("status"),
            "department": i.get("department_id"),
            "asset_id": i.get("asset_id")
        }
        for i in incidents
        if str(i.get("status", "")).upper() in ("OPEN", "INVESTIGATING")
    ][:10]

    overall_trust = round(sum(float(a.get("trust_score", 80.0)) for a in assets) / len(assets), 1) if assets else 100.0
    overall_risk = "HIGH" if len(high_risk_assets) >= 5 or overall_trust < 60 else "MEDIUM" if len(high_risk_assets) > 0 or overall_trust < 80 else "LOW"

    twin_context = {
        "overall_organization_trust_score": overall_trust,
        "total_departments": len(depts),
        "total_employees": total_employees,
        "total_assets_monitored": len(assets),
        "high_risk_assets_count": len(high_risk_assets),
        "total_incidents": len(incidents),
        "open_incidents_count": len(open_incidents),
        "department_telemetry": dept_stats,
        "top_high_risk_assets": high_risk_assets[:5],
        "active_incidents": open_incidents[:5]
    }

    cfg = _get_groq_config()
    user_prompt = f"""Analyze the current TrustSphere Digital Twin organizational state:

{json.dumps(twin_context, indent=2)}

Identify:
1. High-risk assets
2. Affected departments
3. Important incidents
4. Unusual patterns
5. Areas requiring attention

Return a valid JSON object with EXACTLY these fields:
{{
  "summary": "Executive overview of the Digital Twin organizational trust posture ({overall_trust}/100).",
  "risk_level": "{overall_risk}",
  "key_findings": [
    "FACT: High-risk assets and affected departments...",
    "FACT: Active incident load..."
  ],
  "reasoning": [
    "INFERENCE: Unusual pattern or risk concentration...",
    "INFERENCE: Departmental vulnerability analysis..."
  ],
  "recommendations": [
    "Prioritized action 1",
    "Prioritized action 2",
    "Prioritized action 3"
  ],
  "facts": [
    "Direct fact from Digital Twin state"
  ],
  "inferences": [
    "Reasoned conclusion on organizational risk"
  ]
}}"""

    try:
        parsed = _call_groq_json(TRUSTSPHERE_SYSTEM_PROMPT, user_prompt)
        result = _validate_and_normalize_ai_response(
            parsed,
            default_risk=overall_risk,
            model_name=cfg["model"],
            is_live=True,
            provider="Groq"
        )
        result["digital_twin_metrics"] = {
            "overall_trust_score": overall_trust,
            "high_risk_assets_count": len(high_risk_assets),
            "open_incidents_count": len(open_incidents),
            "departments_analyzed": len(depts)
        }
        return result
    except Exception as exc:
        logger.warning(f"Groq Digital Twin analysis failed ({exc}). Using deterministic fallback.")
        most_inc_dept = max(dept_stats, key=lambda x: x["incident_count"])["department"] if dept_stats else "None"
        facts = [
            f"FACT: Organization consensus Trust Score is {overall_trust}/100 across {len(assets)} assets and {len(depts)} departments.",
            f"FACT: Currently tracking {len(high_risk_assets)} high/critical-risk asset(s) and {len(open_incidents)} open/investigating incident(s).",
            f"FACT: Department with highest incident volume is '{most_inc_dept}'."
        ]
        inferences = [
            f"INFERENCE: Risk concentration is elevated in '{most_inc_dept}' based on incident distribution.",
            "INFERENCE: Unresolved high-risk assets reduce the departmental consensus trust index."
        ]
        recs = [
            f"Prioritize triage of {len(open_incidents)} active incident(s), starting with '{most_inc_dept}'.",
            "Quarantine or re-verify assets scoring below 50/100.",
            "Enforce strict sender and attachment filtering on external email ingestion channels."
        ]
        fallback = _validate_and_normalize_ai_response(
            {
                "summary": f"Digital Twin consensus Trust Score is {overall_trust}/100 with {len(high_risk_assets)} high-risk assets and {len(open_incidents)} active incidents across {len(depts)} departments.",
                "risk_level": overall_risk,
                "key_findings": facts,
                "reasoning": inferences,
                "recommendations": recs,
                "facts": facts,
                "inferences": inferences
            },
            default_risk=overall_risk,
            model_name="rule-based-fallback",
            is_live=False,
            provider="TrustSphere Heuristic Intelligence"
        )
        fallback["digital_twin_metrics"] = {
            "overall_trust_score": overall_trust,
            "high_risk_assets_count": len(high_risk_assets),
            "open_incidents_count": len(open_incidents),
            "departments_analyzed": len(depts)
        }
        fallback["fallback_reason"] = str(exc)
        return fallback


def chat_with_ai_assistant(
    question: str,
    context_type: Optional[str] = None,
    entity_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Answers administrator/user questions using real TrustSphere database context.
    Never invents records.
    """
    clean_q = (question or "").strip()
    if not clean_q:
        raise ValueError("Question cannot be empty.")

    assets = list(get_assets_collection().find({}, {"_id": 0, "ai_insights": 0}).sort("trust_score", 1).limit(50))
    incidents = list(get_incidents_collection().find({}, {"_id": 0, "timeline": 0}).sort("created_at", -1).limit(30))
    depts = list(get_departments_collection().find({}, {"_id": 0}))

    highest_risk_asset = assets[0] if assets else None
    dept_incident_counts: Dict[str, int] = {}
    for inc in incidents:
        d = str(inc.get("department_id") or "Unknown")
        dept_incident_counts[d] = dept_incident_counts.get(d, 0) + 1

    top_incident_dept = max(dept_incident_counts.items(), key=lambda x: x[1]) if dept_incident_counts else ("None", 0)
    open_incidents = [i for i in incidents if str(i.get("status", "")).upper() in ("OPEN", "INVESTIGATING")]

    # Check if user mentioned a specific AST-xxxx or INC-xxxx in the question or entity_id
    specific_entity = None
    import re
    ast_match = re.search(r"(AST-[A-Z0-9]+)", clean_q, re.IGNORECASE)
    inc_match = re.search(r"(INC-[A-Z0-9]+)", clean_q, re.IGNORECASE)

    target_id = entity_id or (ast_match.group(1).upper() if ast_match else None) or (inc_match.group(1).upper() if inc_match else None)
    if target_id:
        if target_id.startswith("AST-"):
            specific_entity = get_assets_collection().find_one({"asset_id": target_id}, {"_id": 0})
        elif target_id.startswith("INC-"):
            specific_entity = get_incidents_collection().find_one({"incident_id": target_id}, {"_id": 0})

    avg_trust = round(sum(float(a.get("trust_score", 80.0)) for a in assets) / len(assets), 1) if assets else 100.0

    grounded_context = {
        "organization_summary": {
            "total_assets_sampled": len(assets),
            "average_trust_score": avg_trust,
            "total_incidents": len(incidents),
            "open_incidents_count": len(open_incidents),
            "department_With_most_incidents": {
                "department": top_incident_dept[0],
                "incident_count": top_incident_dept[1]
            },
            "all_department_incident_counts": dept_incident_counts
        },
        "highest_risk_asset": {
            "asset_id": highest_risk_asset.get("asset_id"),
            "filename": highest_risk_asset.get("filename"),
            "trust_score": highest_risk_asset.get("trust_score"),
            "risk_level": highest_risk_asset.get("risk_level") or highest_risk_asset.get("risk"),
            "department": highest_risk_asset.get("department_id"),
            "source": highest_risk_asset.get("source"),
            "anomalies": highest_risk_asset.get("anomalies", []),
            "factors": highest_risk_asset.get("factors", {})
        } if highest_risk_asset else None,
        "top_5_lowest_trust_assets": [
            {
                "asset_id": a.get("asset_id"),
                "filename": a.get("filename"),
                "trust_score": a.get("trust_score"),
                "risk_level": a.get("risk_level") or a.get("risk"),
                "department": a.get("department_id"),
                "source": a.get("source")
            }
            for a in assets[:5]
        ],
        "open_priority_incidents": [
            {
                "incident_id": i.get("incident_id"),
                "title": i.get("title") or i.get("issue_type"),
                "severity": i.get("severity"),
                "status": i.get("status"),
                "department": i.get("department_id"),
                "asset_id": i.get("asset_id"),
                "description": i.get("description")
            }
            for i in open_incidents[:8]
        ],
        "specific_referenced_entity": specific_entity
    }

    cfg = _get_groq_config()
    user_prompt = f"""Administrator Question: "{clean_q}"

Supplied TrustSphere Real-Time Database Context (DO NOT invent records outside this context):
{json.dumps(grounded_context, indent=2, default=str)}

Answer the administrator's question accurately using ONLY the supplied TrustSphere data.
Return a valid JSON object with EXACTLY these fields:
{{
  "summary": "Direct, comprehensive answer to the administrator's question citing exact Asset IDs, Incident IDs, Department names, and Trust Scores.",
  "risk_level": "HIGH or MEDIUM or LOW depending on the subject of the question",
  "key_findings": [
    "FACT: Supporting data point 1 from TrustSphere DB",
    "FACT: Supporting data point 2 from TrustSphere DB"
  ],
  "reasoning": [
    "INFERENCE: Analytical explanation 1",
    "INFERENCE: Analytical explanation 2"
  ],
  "recommendations": [
    "Actionable next step 1",
    "Actionable next step 2"
  ],
  "facts": [
    "Exact database fact used"
  ],
  "inferences": [
    "Analytical conclusion"
  ]
}}"""

    try:
        parsed = _call_groq_json(TRUSTSPHERE_SYSTEM_PROMPT, user_prompt)
        result = _validate_and_normalize_ai_response(
            parsed,
            default_risk="MEDIUM",
            model_name=cfg["model"],
            is_live=True,
            provider="Groq"
        )
        result["question"] = clean_q
        result["answer"] = result["summary"]
        return result
    except Exception as exc:
        logger.warning(f"Groq AI chat failed ({exc}). Generating grounded deterministic response.")
        hr_str = (
            f"{highest_risk_asset.get('asset_id')} ('{highest_risk_asset.get('filename')}', Trust Score: {highest_risk_asset.get('trust_score')}/100, Department: {highest_risk_asset.get('department_id')})"
            if highest_risk_asset else "No assets found"
        )
        first_inc = open_incidents[0] if open_incidents else None
        inc_str = (
            f"{first_inc.get('incident_id')} ({first_inc.get('severity')} in {first_inc.get('department_id')}, Asset: {first_inc.get('asset_id')})"
            if first_inc else "No open incidents"
        )

        summary = (
            f"Based on live TrustSphere telemetry: The highest-risk asset is {hr_str}. "
            f"The department with the most incidents is '{top_incident_dept[0]}' ({top_incident_dept[1]} incidents). "
            f"Priority investigation target: {inc_str}. Organization average Trust Score is {avg_trust}/100."
        )
        facts = [
            f"FACT: Highest-risk asset is {hr_str}.",
            f"FACT: Department '{top_incident_dept[0]}' has the highest incident count ({top_incident_dept[1]}).",
            f"FACT: There are {len(open_incidents)} open/investigating incident(s); top priority is {inc_str}."
        ]
        inferences = [
            "INFERENCE: Assets with the lowest trust scores and open high-severity incidents represent the primary operational exposure."
        ]
        recs = [
            f"Investigate incident {first_inc.get('incident_id')} first." if first_inc else "Continue monitoring incoming asset verifications.",
            f"Inspect asset {highest_risk_asset.get('asset_id')} in {highest_risk_asset.get('department_id')}." if highest_risk_asset else "Maintain baseline controls."
        ]
        fallback = _validate_and_normalize_ai_response(
            {
                "summary": summary,
                "risk_level": "HIGH" if open_incidents else "LOW",
                "key_findings": facts,
                "reasoning": inferences,
                "recommendations": recs,
                "facts": facts,
                "inferences": inferences
            },
            default_risk="HIGH" if open_incidents else "LOW",
            model_name="rule-based-fallback",
            is_live=False,
            provider="TrustSphere Heuristic Intelligence"
        )
        fallback["question"] = clean_q
        fallback["answer"] = fallback["summary"]
        fallback["fallback_reason"] = str(exc)
        return fallback
