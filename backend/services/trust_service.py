from typing import Dict


def calculate_trust_score(
    sender_trust: float,
    document_risk: float,
    behavior_risk: float,
    network_risk: float
) -> Dict:

  
    total_risk = (
        sender_trust * 0.20 +
        document_risk * 0.35 +
        behavior_risk * 0.25 +
        network_risk * 0.20
    )

    trust_score = max(0, min(100, 100 - total_risk))

    if trust_score >= 80:
        level = "HIGH TRUST"
    elif trust_score >= 60:
        level = "MEDIUM TRUST"
    elif trust_score >= 40:
        level = "LOW TRUST"
    else:
        level = "CRITICAL"

    return {
        "trust_score": round(trust_score, 2),
        "trust_level": level,
        "risk_score": round(100 - trust_score, 2)
    }