import re


def detect_pii(content: str) -> dict:
    """
    Detect common Personally Identifiable Information (PII)
    in text content.
    """

    if not content:
        return {
            "score": 100,
            "pii_detected": False,
            "pii_count": 0,
            "detected_types": [],
            "matches": {}
        }

    patterns = {
        "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",

        "phone": r"\b(?:\+91[-\s]?)?[6-9]\d{9}\b",

        "aadhaar": r"\b\d{4}[-\s]\d{4}[-\s]\d{4}\b",

        "pan": r"\b[A-Z]{5}[0-9]{4}[A-Z]\b",

        "ip_address": r"\b(?:\d{1,3}\.){3}\d{1,3}\b",

        "credit_card": r"\b(?:\d{4}[-\s]?){3}\d{4}\b"
    }

    detected = {}
    total_count = 0

    for pii_type, pattern in patterns.items():
        matches = re.findall(pattern, content, re.IGNORECASE)

        if matches:
            detected[pii_type] = matches
            total_count += len(matches)

    # Calculate privacy trust score: 100 if no PII, penalized per exposed PII match
    privacy_score = max(0, 100 - (total_count * 15))

    return {
        "score": privacy_score,
        "pii_detected": total_count > 0,
        "pii_count": total_count,
        "detected_types": list(detected.keys()),
        "matches": detected
    }


def mask_pii(content: str) -> str:
    """
    Replace detected PII with masked values.
    """

    if not content:
        return content

    # Mask email
    content = re.sub(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
        "[EMAIL_REDACTED]",
        content
    )

    # Mask phone numbers
    content = re.sub(
        r"\b(?:\+91[-\s]?)?[6-9]\d{9}\b",
        "[PHONE_REDACTED]",
        content
    )

    # Mask Aadhaar
    content = re.sub(
        r"\b\d{4}[-\s]\d{4}[-\s]\d{4}\b",
        "[AADHAAR_REDACTED]",
        content
    )

    # Mask PAN
    content = re.sub(
        r"\b[A-Z]{5}[0-9]{4}[A-Z]\b",
        "[PAN_REDACTED]",
        content,
        flags=re.IGNORECASE
    )

    # Mask IP address
    content = re.sub(
        r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
        "[IP_REDACTED]",
        content
    )

    # Mask credit card
    content = re.sub(
        r"\b(?:\d{4}[-\s]?){3}\d{4}\b",
        "[CARD_REDACTED]",
        content
    )

    return content