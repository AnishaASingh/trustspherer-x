import re
from pathlib import Path


SUSPICIOUS_KEYWORDS = [
    "urgent",
    "immediately",
    "verify your account",
    "verify account",
    "password",
    "click here",
    "payment required",
    "wire transfer",
    "bank account",
    "invoice",
    "confidential",
    "security alert",
    "login",
    "reset password",
]


def analyze_content(content: str) -> dict:
    """
    Analyze text content for basic suspicious indicators.
    """

    if not content:
        return {
            "score": 100,
            "risk_score": 0,
            "classification": "LOW RISK",
            "suspicious_keywords": [],
            "urls_detected": [],
            "emails_detected": [],
            "word_count": 0,
            "status": "No content provided"
        }

    text = content.lower()

    # Detect suspicious keywords
    detected_keywords = [
        keyword
        for keyword in SUSPICIOUS_KEYWORDS
        if keyword in text
    ]

    # Detect URLs
    urls = re.findall(
        r"https?://[^\s]+",
        content
    )

    # Detect email addresses
    emails = re.findall(
        r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
        content
    )

    word_count = len(content.split())

    # Basic risk calculation
    keyword_risk = min(len(detected_keywords) * 8, 60)
    url_risk = min(len(urls) * 10, 20)
    email_risk = min(len(emails) * 5, 10)

    risk_score = min(
        keyword_risk + url_risk + email_risk,
        100
    )

    if risk_score >= 70:
        classification = "HIGH RISK"
    elif risk_score >= 40:
        classification = "MEDIUM RISK"
    else:
        classification = "LOW RISK"

    trust_score = max(0, 100 - risk_score)

    return {
        "score": trust_score,
        "risk_score": risk_score,
        "classification": classification,
        "suspicious_keywords": detected_keywords,
        "urls_detected": urls,
        "emails_detected": emails,
        "word_count": word_count,
        "status": "Content analyzed successfully"
    }