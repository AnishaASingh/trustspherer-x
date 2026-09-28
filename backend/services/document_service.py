import re
from typing import Dict


def analyze_document(text: str) -> Dict:

    text_lower = text.lower()

    suspicious_keywords = [
        "urgent payment",
        "invoice",
        "verify account",
        "password",
        "click here",
        "bank account",
        "wire transfer",
        "payment required"
    ]

    detected_keywords = []

    for keyword in suspicious_keywords:
        if keyword in text_lower:
            detected_keywords.append(keyword)

    # Basic URL detection
    urls = re.findall(
        r"https?://[^\s]+",
        text
    )

    keyword_risk = min(len(detected_keywords) * 10, 60)
    url_risk = min(len(urls) * 10, 30)

    risk_score = min(keyword_risk + url_risk, 100)

    if risk_score >= 70:
        classification = "HIGH RISK"
    elif risk_score >= 40:
        classification = "MEDIUM RISK"
    else:
        classification = "LOW RISK"

    return {
        "risk_score": risk_score,
        "classification": classification,
        "suspicious_keywords": detected_keywords,
        "urls_detected": urls,
        "url_count": len(urls)
    }