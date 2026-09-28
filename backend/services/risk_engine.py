def safe_score(result, default=50):
    """
    Safely extract a normalized trust score (0-100) from an analysis result.
    """

    if isinstance(result, (int, float)):
        return max(0.0, min(100.0, float(result)))

    if not isinstance(result, dict):
        return default

    try:
        if "score" in result and result["score"] is not None:
            return max(0.0, min(100.0, float(result["score"])))
        if "trust_score" in result and result["trust_score"] is not None:
            return max(0.0, min(100.0, float(result["trust_score"])))
        if "risk_score" in result and result["risk_score"] is not None:
            return max(0.0, min(100.0, 100.0 - float(result["risk_score"])))
        return default
    except (TypeError, ValueError):
        return default


def calculate_risk(
    integrity_result,
    metadata_result,
    structure_result,
    content_result,
    pii_result,
    anomaly_result
):
    """
    TrustSphere Risk Engine.

    Combines the results of the different verification
    layers and produces an overall risk score.
    """

    integrity_score = safe_score(
        integrity_result,
        50
    )

    metadata_score = safe_score(
        metadata_result,
        50
    )

    structure_score = safe_score(
        structure_result,
        50
    )

    content_score = safe_score(
        content_result,
        50
    )

    privacy_score = safe_score(
        pii_result,
        50
    )

    anomaly_score = safe_score(
        anomaly_result,
        50
    )

    # --------------------------------------------------
    # Weighted Trust Score
    # --------------------------------------------------

    trust_score = (
        integrity_score * 0.20 +
        metadata_score * 0.10 +
        structure_score * 0.15 +
        content_score * 0.15 +
        privacy_score * 0.20 +
        anomaly_score * 0.20
    )

    # Security Threshold: If critical content threats, severe PII leakage, or integrity failures occur, cap trust score
    if content_score <= 50 or privacy_score <= 30 or integrity_score <= 40:
        trust_score = min(trust_score, 45.0)
    elif content_score <= 70 or privacy_score <= 60:
        trust_score = min(trust_score, 65.0)

    trust_score = round(
        max(0, min(100, trust_score)),
        2
    )

    # --------------------------------------------------
    # Convert Trust Score to Risk Score
    # --------------------------------------------------

    risk_score = round(
        100 - trust_score,
        2
    )

    # --------------------------------------------------
    # Risk Level
    # --------------------------------------------------

    if risk_score <= 20:

        risk_level = "Low Risk"

    elif risk_score <= 40:

        risk_level = "Medium Risk"

    elif risk_score <= 70:

        risk_level = "High Risk"

    else:

        risk_level = "Critical Risk"

    return {

        "trust_score": trust_score,

        "risk_score": risk_score,

        "risk_level": risk_level,

        "layer_scores": {

            "integrity": integrity_score,

            "metadata": metadata_score,

            "structure": structure_score,

            "content": content_score,

            "privacy": privacy_score,

            "anomaly": anomaly_score

        }

    }