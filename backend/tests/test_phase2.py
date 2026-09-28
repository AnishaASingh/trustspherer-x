import os
import sys
import io
import time

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from database import (
    get_database,
    get_users_collection,
    get_assets_collection,
    get_verifications_collection,
    get_trust_scores_collection,
    get_recommendations_collection,
    get_incidents_collection,
    get_audit_logs_collection,
    get_departments_collection,
    get_employees_collection
)

def generate_sample_pdf(content_text: str = "Standard organizational report for internal review.") -> bytes:
    full_text = f"{content_text} [Nonce: {time.time_ns()}]"
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
    print("RUNNING COMPLETE PHASE 2 BACKEND TEST SUITE")
    print("==================================================")

    with TestClient(app) as client:
        # 1. Test GET / and GET /api/health
        print("\n[1] Testing Root and Health Check:")
        res_root = client.get("/")
        print("GET / -> Status:", res_root.status_code, res_root.json())
        assert res_root.status_code == 200
        assert res_root.json()["success"] is True

        res_health = client.get("/api/health")
        health_body = res_health.json()
        print("GET /api/health -> Status:", res_health.status_code, "DB:", health_body["data"]["database"]["status"])
        assert res_health.status_code == 200
        assert health_body["data"]["database"]["status"] == "connected"

        # 2. Test Auth Flow (Register, Login, Me)
        print("\n[2] Testing Authentication APIs:")
        test_email = f"operator_{int(time.time())}@trustsphere.corp"
        reg_res = client.post("/api/auth/register", json={
            "name": "Operator Alpha",
            "email": test_email,
            "password": "SecurePassword123!",
            "role": "Security Analyst"
        })
        print("POST /api/auth/register -> Status:", reg_res.status_code)
        assert reg_res.status_code == 201
        reg_data = reg_res.json()["data"]
        assert reg_data["email"] == test_email
        assert "password_hash" not in reg_data

        login_res = client.post("/api/auth/login", json={
            "email": test_email,
            "password": "SecurePassword123!"
        })
        print("POST /api/auth/login -> Status:", login_res.status_code)
        assert login_res.status_code == 200
        login_data = login_res.json()["data"]
        jwt_token = login_data["access_token"]
        assert jwt_token is not None
        print("JWT Access Token generated:", jwt_token[:25] + "...")

        me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {jwt_token}"})
        print("GET /api/auth/me -> Status:", me_res.status_code, "User:", me_res.json()["data"]["email"])
        assert me_res.status_code == 200
        assert me_res.json()["data"]["email"] == test_email

        # 3. Test Department APIs
        print("\n[3] Testing Department APIs:")
        depts_res = client.get("/api/departments")
        print("GET /api/departments -> Count:", depts_res.json()["data"]["count"])
        assert depts_res.status_code == 200
        assert depts_res.json()["data"]["count"] >= 5

        new_dept_res = client.post("/api/departments", json={
            "name": f"Cyber Defense Unit {int(time.time()) % 1000}",
            "description": "SOC and Incident Investigation Team"
        })
        print("POST /api/departments -> Status:", new_dept_res.status_code)
        assert new_dept_res.status_code == 201
        new_dept_name = new_dept_res.json()["data"]["name"]

        dept_get = client.get(f"/api/departments/{new_dept_name}")
        print("GET /api/departments/{name} -> Status:", dept_get.status_code)
        assert dept_get.status_code == 200

        dept_patch = client.patch(f"/api/departments/{new_dept_name}", json={
            "description": "Updated SOC and Incident Investigation Team"
        })
        print("PATCH /api/departments/{name} -> Status:", dept_patch.status_code)
        assert dept_patch.status_code == 200

        # 4. Test Employee APIs
        print("\n[4] Testing Employee APIs:")
        emp_create_res = client.post("/api/employees", json={
            "first_name": "Devin",
            "last_name": "Kowalski",
            "email": f"devin_{int(time.time())}@trustsphere.corp",
            "department_id": "IT",
            "role": "Cloud Security Specialist"
        })
        print("POST /api/employees -> Status:", emp_create_res.status_code)
        assert emp_create_res.status_code == 201
        emp_data = emp_create_res.json()["data"]
        emp_code = emp_data["employee_id"]

        emp_list = client.get("/api/employees")
        print("GET /api/employees -> Count:", emp_list.json()["data"]["count"])
        assert emp_list.status_code == 200

        emp_detail = client.get(f"/api/employees/{emp_code}")
        print("GET /api/employees/{id} -> Status:", emp_detail.status_code)
        assert emp_detail.status_code == 200

        emp_patch = client.patch(f"/api/employees/{emp_code}", json={
            "role": "Lead Cloud Security Architect"
        })
        print("PATCH /api/employees/{id} -> Status:", emp_patch.status_code)
        assert emp_patch.status_code == 200
        assert emp_patch.json()["data"]["role"] == "Lead Cloud Security Architect"

        # 5. Test Asset Verification Pipeline (POST /api/verify)
        print("\n[5] Testing POST /api/verify with Real Document:")
        sample_text = "Executive Confidential Memo: Review internal server configurations and firewall ports."
        pdf_bytes = generate_sample_pdf(sample_text)
        files = {
            "file": ("Executive_Security_Memo.pdf", io.BytesIO(pdf_bytes), "application/pdf")
        }
        form_data = {
            "department": "IT",
            "category": "Memo",
            "source": "Corporate Internal Net"
        }
        ver_res = client.post("/api/verify", files=files, data=form_data)
        print("POST /api/verify -> Status:", ver_res.status_code)
        assert ver_res.status_code == 200
        ver_json = ver_res.json()
        assert ver_json["success"] is True
        ver_data = ver_json["data"]
        asset_id = ver_data["asset_id"]
        ver_id = ver_data["verification_id"]
        print(f"Asset ID: {asset_id} | Verification ID: {ver_id}")
        print(f"Trust Score: {ver_data['trust_score']}/100 | Risk: {ver_data['risk']}")
        print(f"Checks evaluated: {len(ver_data['checks'])}")
        print(f"Factors: {ver_data['factors']}")
        assert len(ver_data["checks"]) >= 6

        # 6. Test Asset Query APIs
        print("\n[6] Testing Asset Registry & Detail APIs:")
        assets_res = client.get("/api/assets")
        print("GET /api/assets -> Count:", assets_res.json()["data"]["count"])
        assert assets_res.status_code == 200

        asset_detail_res = client.get(f"/api/assets/{asset_id}")
        print("GET /api/assets/{asset_id} -> Status:", asset_detail_res.status_code)
        assert asset_detail_res.status_code == 200
        detail_data = asset_detail_res.json()["data"]
        assert detail_data["asset"]["asset_id"] == asset_id
        assert detail_data["verification"]["verification_id"] == ver_id

        # Test recommendations API
        rec_api_res = client.get(f"/api/assets/{asset_id}/recommendations")
        print("GET /api/assets/{asset_id}/recommendations -> Status:", rec_api_res.status_code)
        assert rec_api_res.status_code == 200

        # Test re-analyze API
        reanalyze_res = client.post(f"/api/assets/{asset_id}/reanalyze")
        print("POST /api/assets/{asset_id}/reanalyze -> Status:", reanalyze_res.status_code)
        assert reanalyze_res.status_code == 200
        assert reanalyze_res.json()["data"]["asset_id"] == asset_id

        # 7. Test High-Risk Document and Incident Lifecycle
        print("\n[7] Testing High-Risk Ingestion & Incident Generation:")
        phish_text = "URGENT: Immediately click here to verify your account and reset password. Wire transfer required to avoid suspension."
        phish_pdf = generate_sample_pdf(phish_text)
        phish_files = {
            "file": ("Urgent_Payroll_Notice.pdf", io.BytesIO(phish_pdf), "application/pdf")
        }
        phish_data = {
            "department": "Finance",
            "category": "Notice",
            "source": "External Inbound Gateway"
        }
        phish_res = client.post("/api/verify", files=phish_files, data=phish_data)
        print("POST /api/verify (High Risk) -> Status:", phish_res.status_code)
        assert phish_res.status_code == 200
        phish_json = phish_res.json()["data"]
        phish_incident_id = phish_json["incident_id"]
        print(f"Generated Incident ID: {phish_incident_id} (Severity: {phish_json['risk']})")
        assert phish_incident_id is not None

        # Incident APIs
        inc_list = client.get("/api/incidents")
        print("GET /api/incidents -> Count:", inc_list.json()["data"]["count"])
        assert inc_list.status_code == 200

        inc_get = client.get(f"/api/incidents/{phish_incident_id}")
        print("GET /api/incidents/{incident_id} -> Status:", inc_get.status_code)
        assert inc_get.status_code == 200

        # Patch incident status
        inc_patch = client.patch(f"/api/incidents/{phish_incident_id}/status", json={
            "status": "INVESTIGATING",
            "note": "SOC analyst assigned to verify sender headers."
        })
        print("PATCH /api/incidents/{id}/status -> Status:", inc_patch.status_code)
        assert inc_patch.status_code == 200
        assert inc_patch.json()["data"]["new_status"] == "INVESTIGATING"

        # 8. Test Audit Logs API
        print("\n[8] Testing Audit Logs API:")
        audit_res = client.get("/api/audit-logs")
        print("GET /api/audit-logs -> Count:", audit_res.json()["data"]["count"])
        assert audit_res.status_code == 200
        logs = audit_res.json()["data"]["audit_logs"]
        actions = [l["action"] for l in logs]
        print("Recent audit actions recorded in DB:", actions[:5])
        assert "ASSET_VERIFIED" in actions
        assert "LOGIN" in actions

        # 9. Test Dynamic Dashboard Metrics API (Phase 2 Section 8)
        print("\n[9] Testing Dynamic Dashboard Metrics API:")
        dash_res = client.get("/api/dashboard/metrics")
        print("GET /api/dashboard/metrics -> Status:", dash_res.status_code)
        assert dash_res.status_code == 200
        dash_metrics = dash_res.json()["data"]
        print("Dashboard Metrics calculated dynamically from MongoDB:")
        print("  - Total Assets:", dash_metrics["total_assets"])
        print("  - Total Incidents:", dash_metrics["total_incidents"])
        print("  - Open Incidents:", dash_metrics["open_incidents"])
        print("  - Critical Incidents:", dash_metrics["critical_incidents"])
        print("  - High Risk Assets:", dash_metrics["high_risk_assets"])
        print("  - Average Trust Score:", dash_metrics["average_trust_score"])
        print("  - Total Employees:", dash_metrics["total_employees"])
        print("  - Total Departments:", dash_metrics["total_departments"])
        print("  - Risk Distribution:", dash_metrics["risk_distribution"])
        assert dash_metrics["total_assets"] > 0
        assert dash_metrics["total_incidents"] > 0
        assert dash_metrics["total_departments"] >= 5

        # 10. Confirm Collections in MongoDB
        print("\n[10] Confirming Core MongoDB Collections:")
        db = get_database()
        cols = db.list_collection_names()
        print("Collections present in TrustSphereDB:", cols)
        core_9 = [
            "users", "departments", "employees", "assets",
            "asset_verifications", "trust_scores", "incidents",
            "recommendations", "audit_logs"
        ]
        for c in core_9:
            assert c in cols, f"Collection {c} missing!"
        print("All 9 core collections verified in MongoDB.")

    print("\n==================================================")
    print("ALL PHASE 2 BACKEND API TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
