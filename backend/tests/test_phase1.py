import os
import sys
import io

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from database import (
    get_database,
    get_assets_collection,
    get_verifications_collection,
    get_trust_scores_collection,
    get_recommendations_collection,
    get_incidents_collection,
    get_audit_logs_collection,
    get_departments_collection
)

def generate_sample_pdf(content_text: str = "Standard organizational report for internal review.") -> bytes:
    """Generates a valid minimal binary PDF document with specified text."""
    import time
    full_text = f"{content_text} [Ref: {time.time_ns()}]"
    stream_content = f"BT /F1 12 Tf 72 712 Td ({full_text}) Tj ET\n"
    stream_len = len(stream_content.encode("utf-8"))
    
    pdf_text = f"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>
endobj
4 0 obj
<< /Length {stream_len} >>
stream
{stream_content}endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000280 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
{380 + stream_len}
%%EOF
"""
    return pdf_text.encode("utf-8")


def run_tests():
    print("==================================================")
    print("RUNNING TRUSTSPHERE PHASE 1 TEST SUITE")
    print("==================================================")

    with TestClient(app) as client:
        # 1. Test GET /
        res_root = client.get("/")
        print("\n1. Testing GET /:")
        print(f"Status: {res_root.status_code}")
        print("Response:", res_root.json())
        assert res_root.status_code == 200

        # 2. Test GET /api/health
        res_health = client.get("/api/health")
        print("\n2. Testing GET /api/health:")
        print(f"Status: {res_health.status_code}")
        health_data = res_health.json()
        print("Response:", health_data)
        assert res_health.status_code == 200
        db_info = health_data.get("data", {}).get("database") or health_data.get("database", {})
        assert db_info.get("status") == "connected"
        print("--> MongoDB is CONNECTED to database:", db_info.get("database"))

        # 3. Test POST /api/verify with Normal Clean PDF
        print("\n3. Testing POST /api/verify (Clean Document):")
        clean_pdf_bytes = generate_sample_pdf("TrustSphere Annual IT Security Architecture Overview")
        files = {
            "file": ("Annual_Security_Report.pdf", io.BytesIO(clean_pdf_bytes), "application/pdf")
        }
        data = {
            "department": "IT",
            "category": "Report",
            "source": "Corporate Portal"
        }
        res_verify_clean = client.post("/api/verify", files=files, data=data)
        print(f"Status: {res_verify_clean.status_code}")
        clean_raw = res_verify_clean.json()
        clean_result = clean_raw.get("data", clean_raw)
        clean_aid = clean_raw.get("assetId") or clean_result.get("asset_id") or clean_result.get("assetId")
        clean_ts = clean_raw.get("trustScore") or clean_result.get("trust_score") or clean_result.get("trustScore")
        clean_risk = clean_raw.get("risk") or clean_result.get("risk")
        clean_inc = clean_raw.get("incidentId") or clean_result.get("incident_id") or clean_result.get("incidentId")
        print(f"Clean Document Trust Score: {clean_ts}/100")
        print(f"Risk Level: {clean_risk}")
        print(f"Asset ID: {clean_aid}")
        print(f"Verification ID: {clean_raw.get('verificationId') or clean_result.get('verification_id')}")
        print(f"Incident Created: {clean_inc}")
        assert res_verify_clean.status_code == 200
        assert clean_inc is None, "Clean doc should NOT trigger an incident!"

        # 4. Test POST /api/verify with Phishing / High-Risk Document (Contains urgent, password, wire transfer, PII)
        print("\n4. Testing POST /api/verify (High-Risk Document with suspicious terms and PII):")
        suspicious_text = "URGENT payment required immediately. Please verify your account and reset password. Wire transfer to bank account. Contact admin@fake-hack.com or phone +91 9876543210. Aadhaar: 1234 5678 9012"
        suspicious_pdf_bytes = generate_sample_pdf(suspicious_text)
        files_suspicious = {
            "file": ("Urgent_Wire_Transfer_Invoice.pdf", io.BytesIO(suspicious_pdf_bytes), "application/pdf")
        }
        data_suspicious = {
            "department": "Finance",
            "category": "Invoice",
            "source": "External Email Gateway"
        }
        res_verify_sus = client.post("/api/verify", files=files_suspicious, data=data_suspicious)
        print(f"Status: {res_verify_sus.status_code}")
        sus_raw = res_verify_sus.json()
        sus_result = sus_raw.get("data", sus_raw)
        sus_aid = sus_raw.get("assetId") or sus_result.get("asset_id") or sus_result.get("assetId")
        sus_ts = sus_raw.get("trustScore") or sus_result.get("trust_score") or sus_result.get("trustScore")
        sus_risk = sus_raw.get("risk") or sus_result.get("risk")
        sus_inc = sus_raw.get("incidentId") or sus_result.get("incident_id") or sus_result.get("incidentId")
        print(f"Suspicious Document Trust Score: {sus_ts}/100")
        print(f"Risk Level: {sus_risk}")
        print(f"Asset ID: {sus_aid}")
        print(f"Incident Created: {sus_inc}")
        print(f"Anomalies detected: {sus_raw.get('anomalies') or sus_result.get('anomalies')}")
        print(f"Recommendations: {sus_raw.get('recommendations') or sus_result.get('recommendations')}")
        assert res_verify_sus.status_code == 200
        assert sus_inc is not None, "High/Critical risk doc MUST trigger an incident!"

        # 5. Verify MongoDB Persistence
        print("\n5. Verifying MongoDB Documents Across Core Collections:")
        db = get_database()
        
        # Check assets
        asset_count = db.assets.count_documents({})
        last_asset = db.assets.find_one({"asset_id": sus_aid})
        print(f"assets collection count: {asset_count}")
        print(f"Retrieved asset from DB: {last_asset['filename']} (Hash: {last_asset['file_hash'][:16]}...)")
        assert last_asset is not None

        # Check asset_verifications
        ver_count = db.asset_verifications.count_documents({})
        last_ver = db.asset_verifications.find_one({"asset_id": sus_aid})
        print(f"asset_verifications collection count: {ver_count}")
        assert last_ver is not None
        assert "layer_1_file_integrity" in last_ver
        assert "layer_7_risk" in last_ver

        # Check trust_scores
        trust_count = db.trust_scores.count_documents({})
        last_ts = db.trust_scores.find_one({"asset_id": sus_aid})
        print(f"trust_scores collection count: {trust_count}")
        assert last_ts is not None

        # Check recommendations
        rec_count = db.recommendations.count_documents({})
        last_rec = db.recommendations.find_one({"asset_id": sus_aid})
        print(f"recommendations collection count: {rec_count}")
        assert last_rec is not None

        # Check incidents
        inc_count = db.incidents.count_documents({})
        last_inc = db.incidents.find_one({"incident_id": sus_inc})
        print(f"incidents collection count: {inc_count}")
        print(f"Retrieved incident from DB: {last_inc['incident_id']} - Severity: {last_inc['severity']}")
        assert last_inc is not None

        # Check audit_logs
        log_count = db.audit_logs.count_documents({})
        last_log = db.audit_logs.find_one({"entity_id": sus_aid}) or db.audit_logs.find_one({"resource_id": sus_aid})
        print(f"audit_logs collection count: {log_count}")
        if last_log:
            print(f"Retrieved audit log: {last_log.get('action')} on {last_log.get('entity_type', last_log.get('resource'))} -> {last_log.get('result')}")
        assert last_log is not None

        # Check departments
        dept_count = db.departments.count_documents({})
        print(f"departments collection count: {dept_count}")
        assert dept_count >= 5

        # 6. Test Routers Endpoints
        print("\n6. Testing Router Endpoints:")
        res_assets = client.get("/api/assets")
        assets_body = res_assets.json().get("data", res_assets.json())
        print(f"GET /api/assets count: {assets_body.get('count', len(assets_body.get('assets', [])))}")
        assert res_assets.status_code == 200

        res_asset_detail = client.get(f"/api/assets/{sus_aid}")
        print(f"GET /api/assets/{sus_aid} status: {res_asset_detail.status_code}")
        assert res_asset_detail.status_code == 200

        res_incidents = client.get("/api/incidents")
        inc_body = res_incidents.json().get("data", res_incidents.json())
        print(f"GET /api/incidents count: {inc_body.get('count', len(inc_body.get('incidents', [])))}")
        assert res_incidents.status_code == 200

        res_audit = client.get("/api/audit-logs")
        audit_body = res_audit.json().get("data", res_audit.json())
        print(f"GET /api/audit-logs count: {audit_body.get('count', len(audit_body.get('logs', [])))}")
        assert res_audit.status_code == 200

        res_depts = client.get("/api/departments")
        depts_body = res_depts.json().get("data", res_depts.json())
        depts_list = depts_body.get("departments", depts_body)
        print(f"GET /api/departments count: {len(depts_list)}")
        assert res_depts.status_code == 200

    print("\n==================================================")
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
