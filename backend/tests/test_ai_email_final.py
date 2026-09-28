import os
import sys
import json
import uuid
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:5173"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.ai_intelligence import _call_groq_json, generate_ai_security_insights


def http_req(path, method="GET", data=None, token=None, headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = headers.copy() if headers else {}
    if token:
        req_headers["Authorization"] = f"Bearer {token}"
    body = None
    if data is not None and not isinstance(data, bytes):
        body = json.dumps(data).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    elif isinstance(data, bytes):
        body = data

    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read().decode("utf-8"))
        except Exception:
            err_body = {"raw": str(e)}
        return e.code, err_body


def build_multipart(fields, file_field=None):
    boundary = f"----TrustSphereBoundary{uuid.uuid4().hex}"
    lines = []
    for k, v in fields.items():
        lines.append(f"--{boundary}".encode("utf-8"))
        lines.append(f'Content-Disposition: form-data; name="{k}"\r\n'.encode("utf-8"))
        lines.append(str(v).encode("utf-8"))
    if file_field:
        field_name, filename, content_type, file_bytes = file_field
        lines.append(f"--{boundary}".encode("utf-8"))
        lines.append(
            f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\nContent-Type: {content_type}\r\n'.encode("utf-8")
        )
        lines.append(file_bytes)
    lines.append(f"--{boundary}--\r\n".encode("utf-8"))
    body = b"\r\n".join(lines)
    return body, {"Content-Type": f"multipart/form-data; boundary={boundary}"}


def run_all_tests():
    results = []

    def check(name, passed, detail=""):
        status_str = "PASS" if passed else "FAIL"
        print(f"[{status_str}] {name} -> {detail}")
        results.append((name, passed, detail))
        if not passed:
            raise AssertionError(f"Check failed: {name} ({detail})")

    # 1. Backend Health & MongoDB Connection
    code, res = http_req("/api/health")
    check("1. Backend & MongoDB Health", code == 200 and res.get("success") is True, f"HTTP {code}, DB={res.get('data', {}).get('database', {}).get('status')}")

    # 2. Swagger Docs Reachable
    req = urllib.request.Request(f"{BASE_URL}/docs")
    with urllib.request.urlopen(req, timeout=10) as r:
        check("2. Swagger Docs (/docs)", r.status == 200, f"HTTP {r.status}")

    # 3. Frontend Reachable
    req_fe = urllib.request.Request(FRONTEND_URL)
    with urllib.request.urlopen(req_fe, timeout=10) as r:
        check("3. Frontend Dev Server (5173)", r.status == 200, f"HTTP {r.status}")

    # 4. Unauthenticated /api/ai/* Rejected (401)
    code_unauth, _ = http_req("/api/ai/status")
    check("4. AI Endpoints Require Auth", code_unauth == 401, f"Unauthenticated HTTP {code_unauth}")

    # 5. Admin Login
    code_login, login_res = http_req(
        "/api/auth/login",
        method="POST",
        data={"email": "admin@trustsphere.com", "password": "Admin@123"}
    )
    token = login_res.get("data", {}).get("access_token")
    check("5. Admin Login (admin@trustsphere.com)", code_login == 200 and bool(token), "JWT token issued")

    # 6. User Management Works
    code_users, users_res = http_req("/api/users", token=token)
    users_list = users_res.get("data", {}).get("users", [])
    has_pw_hash = any("password_hash" in u for u in users_list)
    check("6. Admin User Management", code_users == 200 and len(users_list) >= 1 and not has_pw_hash, f"{len(users_list)} users returned, password_hash hidden={not has_pw_hash}")

    # 7. Manual Upload + 7-Layer Verification + Groq AI
    unique_manual_content = f"CONFIDENTIAL FINANCIAL WIRE TRANSFER OVERRIDE\nPassword reset urgent bypass token {uuid.uuid4().hex}\nSSN: 123-45-6789\nContact: risk@corp.com\n".encode("utf-8")
    mp_body, mp_headers = build_multipart(
        {"department": "Finance", "source": "Manual Verification Test"},
        ("file", "Urgent_Wire_Override.txt", "text/plain", unique_manual_content)
    )
    code_ver, ver_res = http_req("/api/verify", method="POST", data=mp_body, token=token, headers=mp_headers)
    asset_data = ver_res.get("data", {})
    asset_id = asset_data.get("asset_id")
    ai_ins = asset_data.get("ai_insights", {})
    check(
        "7. Manual Asset Upload & 7-Layer + Groq AI",
        code_ver == 200 and bool(asset_id) and bool(ai_ins.get("summary")),
        f"Asset={asset_id}, Score={asset_data.get('trust_score')}, Risk={asset_data.get('risk')}, Model={ai_ins.get('model_used')}"
    )

    # 8. Groq AI Status Endpoint
    code_aist, aist_res = http_req("/api/ai/status", token=token)
    ai_st_data = aist_res.get("data", {})
    check(
        "8. Groq AI Status (openai/gpt-oss-20b)",
        code_aist == 200 and ai_st_data.get("model") == "openai/gpt-oss-20b" and ai_st_data.get("live_llm_enabled") is True,
        f"Model={ai_st_data.get('model')}, Live={ai_st_data.get('live_llm_enabled')}"
    )

    # 9. POST /api/ai/analyze-asset
    code_aa, aa_res = http_req("/api/ai/analyze-asset", method="POST", data={"asset_id": asset_id}, token=token)
    aa_data = aa_res.get("data", {})
    check(
        "9. POST /api/ai/analyze-asset",
        code_aa == 200 and aa_data.get("is_live_llm") is True and bool(aa_data.get("summary")),
        f"LiveLLM={aa_data.get('is_live_llm')}, Summary='{aa_data.get('summary', '')[:65]}...'"
    )

    # 10. POST /api/ai/analyze-incident
    code_inc_list, inc_list_res = http_req("/api/incidents", token=token)
    incidents = inc_list_res.get("data", {}).get("incidents", [])
    target_inc_id = asset_data.get("incident_id") or (incidents[0]["incident_id"] if incidents else None)
    code_ai_inc, ai_inc_res = http_req("/api/ai/analyze-incident", method="POST", data={"incident_id": target_inc_id}, token=token)
    ai_inc_data = ai_inc_res.get("data", {})
    check(
        "10. POST /api/ai/analyze-incident",
        code_ai_inc == 200 and ai_inc_data.get("is_live_llm") is True and bool(ai_inc_data.get("summary")),
        f"Incident={target_inc_id}, LiveLLM={ai_inc_data.get('is_live_llm')}"
    )

    # 11. POST /api/ai/analyze-digital-twin
    code_dt, dt_res = http_req("/api/ai/analyze-digital-twin", method="POST", data={}, token=token)
    dt_data = dt_res.get("data", {})
    check(
        "11. POST /api/ai/analyze-digital-twin",
        code_dt == 200 and dt_data.get("is_live_llm") is True and bool(dt_data.get("summary")),
        f"Risk={dt_data.get('risk_level')}, LiveLLM={dt_data.get('is_live_llm')}"
    )

    # 12. POST /api/ai/chat (Security Assistant)
    code_chat, chat_res = http_req(
        "/api/ai/chat",
        method="POST",
        data={
            "question": "Which department has the highest risk and what should the admin review first?",
            "context_type": "dashboard"
        },
        token=token
    )
    chat_data = chat_res.get("data", {})
    check(
        "12. POST /api/ai/chat (AI Security Assistant)",
        code_chat == 200 and chat_data.get("is_live_llm") is True and bool(chat_data.get("summary")),
        f"LiveLLM={chat_data.get('is_live_llm')}, Answer='{chat_data.get('summary', '')[:65]}...'"
    )

    # 13. AI Fallback Test (when API key is missing/invalid)
    old_key = os.environ.get("GROQ_API_KEY", "")
    try:
        os.environ["GROQ_API_KEY"] = ""
        fb_res = generate_ai_security_insights(
            trust_score=42.0,
            risk_score=58.0,
            risk_level="High Risk",
            layer_scores={"integrity": 80, "metadata": 50, "structure": 60, "content": 30, "privacy": 40, "anomaly": 45},
            detected_threats=["urgent", "wire transfer"],
            detected_pii_count=1,
            detected_pii_types=["ssn"],
            department="Finance",
            asset_type="Invoice",
            filename="Fallback_Test.pdf"
        )
        check(
            "13. Deterministic AI Fallback When Key Missing",
            fb_res.get("is_live_llm") is False and bool(fb_res.get("summary")) and len(fb_res.get("recommendations", [])) > 0,
            f"is_live_llm={fb_res.get('is_live_llm')}, summary='{fb_res.get('summary', '')[:50]}...'"
        )
    finally:
        os.environ["GROQ_API_KEY"] = old_key

    # 14. OAuth Status & Honest Unconfigured Check (admin@trustsphere.com is NOT monitored mailbox)
    code_oa, oa_res = http_req("/api/ingestion/email/oauth/status", token=token)
    oa_data = oa_res.get("data", {})
    check(
        "14. Email OAuth Status & Identity Separation",
        code_oa == 200 and oa_data.get("status") == "Not Connected" and oa_data.get("email_address") is None,
        f"Status={oa_data.get('status')}, Email={oa_data.get('email_address')}"
    )

    # 15. Demo Email Ingestion End-to-End (creates asset + verification + trust score + AI + audit + Digital Twin)
    custom_msg_id = f"DEMO-TEST-{uuid.uuid4().hex[:8].upper()}@external-partner.com"
    demo_att_bytes = f"Invoice #99281\nUrgent wire transfer credential override request {uuid.uuid4().hex}\nSSN: 999-11-2222\n".encode("utf-8")
    demo_body, demo_headers = build_multipart(
        {
            "sender": "billing@external-partner.com",
            "subject": "Urgent Vendor Wire Transfer Invoice",
            "body_text": "Please process this urgent wire transfer invoice immediately.",
            "department": "Finance",
            "message_id": custom_msg_id
        },
        ("file", "Vendor_Wire_Invoice.txt", "text/plain", demo_att_bytes)
    )
    code_demo, demo_res = http_req("/api/ingestion/email/demo", method="POST", data=demo_body, token=token, headers=demo_headers)
    demo_data = demo_res.get("data", {})
    created_demo_assets = demo_data.get("created_assets", [])
    check(
        "15. Demo Email Ingestion Full Pipeline",
        code_demo == 200 and demo_res.get("success") is True and len(created_demo_assets) >= 1 and demo_data.get("is_demo") is True,
        f"Created Assets={created_demo_assets}, Mode={demo_data.get('ingestion_mode')}"
    )

    # 16. Duplicate Email Message-ID Rejected
    dup_body, dup_headers = build_multipart(
        {
            "sender": "billing@external-partner.com",
            "subject": "Urgent Vendor Wire Transfer Invoice",
            "body_text": "Duplicate transmission test.",
            "department": "Finance",
            "message_id": custom_msg_id
        },
        ("file", "Vendor_Wire_Invoice.txt", "text/plain", demo_att_bytes)
    )
    code_dup, dup_res = http_req("/api/ingestion/email/demo", method="POST", data=dup_body, token=token, headers=dup_headers)
    dup_data = dup_res.get("data", {})
    check(
        "16. Duplicate Email Message-ID Prevention",
        dup_res.get("success") is False and dup_data.get("is_duplicate_message") is True,
        f"Rejected duplicate Message-ID={custom_msg_id}"
    )

    # 17. Invalid File Type Rejected Safely (.exe)
    bad_body, bad_headers = build_multipart(
        {
            "sender": "attacker@malicious.org",
            "subject": "Executable Payload",
            "body_text": "See attached installer.",
            "department": "IT"
        },
        ("file", "trojan_payload.exe", "application/octet-stream", b"MZ\x90\x00\x03")
    )
    code_bad, bad_res = http_req("/api/ingestion/email/demo", method="POST", data=bad_body, token=token, headers=bad_headers)
    check(
        "17. Unsafe Attachment File Type Rejected (.exe)",
        bad_res.get("success") is False and bad_res.get("data", {}).get("rejected") is True,
        f"Reason: {bad_res.get('message')}"
    )

    # 18. Secret Hygiene Verification
    with open(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env.example"), "r", encoding="utf-8") as f:
        env_example_text = f.read()
    with open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", ".env"), "r", encoding="utf-8") as f:
        fe_env_text = f.read()
    check(
        "18. No Secret Exposed in .env.example or frontend/.env",
        "gsk_" not in env_example_text and "gsk_" not in fe_env_text and "GROQ_API_KEY" not in fe_env_text,
        "Verified zero real keys in .env.example and frontend/.env"
    )

    print("\nALL 18 END-TO-END VERIFICATION CHECKS PASSED 100%!")


if __name__ == "__main__":
    run_all_tests()
