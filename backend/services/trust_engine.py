def generate_trust_result(
    filename,
    integrity,
    metadata,
    structure,
    content,
    pii,
    anomaly,
    risk
):
    """
    Generate the final TrustSphere result.
    """

    trust_score = risk.get(
        "trust_score",
        0
    )

    risk_score = risk.get(
        "risk_score",
        100
    )

    risk_level = risk.get(
        "risk_level",
        "Unknown"
    )

    # --------------------------------------------------
    # Generate recommendation
    # --------------------------------------------------

    if risk_level == "Low Risk":

        recommendation = (
            "The digital asset appears trustworthy. "
            "No major security concerns were identified."
        )

    elif risk_level == "Medium Risk":

        recommendation = (
            "Review the asset before using or sharing it. "
            "Some unusual characteristics were detected."
        )

    elif risk_level == "High Risk":

        recommendation = (
            "Further investigation is recommended. "
            "The asset contains potentially suspicious "
            "or risky characteristics."
        )

    elif risk_level == "Critical Risk":

        recommendation = (
            "Do not trust or distribute this asset until "
            "a detailed security investigation is completed."
        )

    else:

        recommendation = (
            "Manual investigation is recommended."
        )

    # --------------------------------------------------
    # Final result
    # --------------------------------------------------

    return {

        "filename": filename,

        "trust_score": trust_score,

        "risk_score": risk_score,

        "risk_level": risk_level,

        "recommendation": recommendation,

        "verification_summary": {

            "file_integrity": integrity,

            "metadata": metadata,

            "structure": structure,

            "content": content,

            "privacy": pii,

            "anomaly": anomaly

        }

    }