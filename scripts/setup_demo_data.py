import os
import sys
import time
import json
import urllib.request
import urllib.parse
from pymongo import MongoClient

import sys
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

BASE_URL = "http://127.0.0.1:8000"
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "TrustSphereDB"

def generate_pdf(text_content: str) -> bytes:
    """Generates standard, valid PDF-1.4 bytes containing single-page text."""
    header = b"%PDF-1.4\n"
    obj1 = b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    obj2 = b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    obj3 = b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\nendobj\n"
    
    # Sanitize parentheses for PDF text stream
    sanitized_text = text_content.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    stream_data = f"BT /F1 12 Tf 50 700 Td ({sanitized_text}) Tj ET\n".encode("latin-1", "replace")
    obj4 = f"4 0 obj\n<< /Length {len(stream_data)} >>\nstream\n".encode("latin-1") + stream_data + b"endstream\nendobj\n"
    
    offset1 = len(header)
    offset2 = offset1 + len(obj1)
    offset3 = offset2 + len(obj2)
    offset4 = offset3 + len(obj3)
    xref_offset = offset4 + len(obj4)
    
    xref = f"xref\n0 5\n0000000000 65535 f \n{offset1:010d} 00000 n \n{offset2:010d} 00000 n \n{offset3:010d} 00000 n \n{offset4:010d} 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode("latin-1")
    
    return header + obj1 + obj2 + obj3 + obj4 + xref


def http_post_json(url: str, data: dict, headers: dict = None) -> tuple:
    data_bytes = json.dumps(data).encode("utf-8")
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data_bytes, headers=h, method="POST")
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode())


def http_get(url: str, headers: dict = None) -> tuple:
    h = headers or {}
    req = urllib.request.Request(url, headers=h, method="GET")
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode())


def http_post_multipart(url: str, fields: dict, files: dict, headers: dict = None) -> tuple:
    boundary = "----WebKitFormBoundaryTrustSphereDemoSetup"
    body = bytearray()
    
    for k, v in fields.items():
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode("utf-8"))
        body.extend(f"{v}\r\n".encode("utf-8"))
        
    for k, (filename, file_bytes, content_type) in files.items():
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{k}"; filename="{filename}"\r\n'.encode("utf-8"))
        body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
        body.extend(file_bytes)
        body.extend(b"\r\n")
        
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))
    
    h = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=bytes(body), headers=h, method="POST")
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode())


def setup_demo_data():
    print("=" * 75)
    print("TRUSTSPHERE — DEMONSTRATION DATA INITIALIZATION")
    print("Preparing realistic Indian enterprise demonstration data")
    print("=" * 75)

    # Step 1: Authenticate as default admin
    print("\n[STEP 1/5] Authenticating as Enterprise Administrator...")
    login_payload = {"email": "admin@trustsphere.com", "password": "Admin@123"}
    try:
        status_code, login_resp = http_post_json(f"{BASE_URL}/api/auth/login", login_payload)
        token = login_resp.get("data", {}).get("access_token")
        auth_headers = {"Authorization": f"Bearer {token}"}
        print(f"  [OK] Admin authenticated successfully. Access token acquired.")
    except Exception as e:
        print(f"  [ERROR] Admin authentication failed: {e}")
        return False

    # Step 2: Create Departments
    print("\n[STEP 2/5] Registering 5 Core Enterprise Departments...")
    departments_def = [
        {
            "name": "Information Technology",
            "description": "Enterprise cloud infrastructure, cybersecurity perimeter, and core software engineering systems.",
            "status": "ACTIVE"
        },
        {
            "name": "Human Resources",
            "description": "Talent acquisition, corporate employee policies, and organizational workforce compliance.",
            "status": "ACTIVE"
        },
        {
            "name": "Finance",
            "description": "Corporate financial planning, vendor invoice reconciliation, taxation, and statutory audits.",
            "status": "ACTIVE"
        },
        {
            "name": "Operations",
            "description": "Day-to-day facilities management, customer logistics, procurement, and process integrity.",
            "status": "ACTIVE"
        },
        {
            "name": "Legal & Compliance",
            "description": "Enterprise statutory regulatory adherence, contract validation, and data governance standards.",
            "status": "ACTIVE"
        }
    ]

    created_depts = []
    for d in departments_def:
        try:
            status_code, resp = http_post_json(f"{BASE_URL}/api/departments", d, auth_headers)
            dept_data = resp.get("data", {})
            created_depts.append(dept_data)
            print(f"  [+] Department: '{dept_data.get('name')}' (Status: {dept_data.get('status')})")
        except urllib.error.HTTPError as he:
            err_body = json.loads(he.read().decode())
            if "already exists" in str(err_body):
                print(f"  [INFO] Department '{d['name']}' already exists.")
            else:
                print(f"  [ERROR] Department creation error ({d['name']}): {err_body}")

    # Step 3: Create Employees
    print("\n[STEP 3/5] Provisioning 8 Realistic Indian Enterprise Personnel...")
    employees_def = [
        {
            "first_name": "Ananya",
            "last_name": "Sharma",
            "email": "ananya.sharma@trustsphere.com",
            "department_id": "Information Technology",
            "role": "IT Manager",
            "status": "ACTIVE"
        },
        {
            "first_name": "Rohan",
            "last_name": "Patil",
            "email": "rohan.patil@trustsphere.com",
            "department_id": "Information Technology",
            "role": "Software Engineer",
            "status": "ACTIVE"
        },
        {
            "first_name": "Priya",
            "last_name": "Deshmukh",
            "email": "priya.deshmukh@trustsphere.com",
            "department_id": "Human Resources",
            "role": "HR Executive",
            "status": "ACTIVE"
        },
        {
            "first_name": "Aditya",
            "last_name": "Kulkarni",
            "email": "aditya.kulkarni@trustsphere.com",
            "department_id": "Finance",
            "role": "Finance Analyst",
            "status": "ACTIVE"
        },
        {
            "first_name": "Sneha",
            "last_name": "Joshi",
            "email": "sneha.joshi@trustsphere.com",
            "department_id": "Finance",
            "role": "Senior Accountant",
            "status": "ACTIVE"
        },
        {
            "first_name": "Rahul",
            "last_name": "Mehta",
            "email": "rahul.mehta@trustsphere.com",
            "department_id": "Operations",
            "role": "Operations Manager",
            "status": "ACTIVE"
        },
        {
            "first_name": "Neha",
            "last_name": "Shah",
            "email": "neha.shah@trustsphere.com",
            "department_id": "Legal & Compliance",
            "role": "Compliance Officer",
            "status": "ACTIVE"
        },
        {
            "first_name": "Arjun",
            "last_name": "Nair",
            "email": "arjun.nair@trustsphere.com",
            "department_id": "Operations",
            "role": "Operations Executive",
            "status": "ACTIVE"
        }
    ]

    created_employees = []
    for emp in employees_def:
        try:
            status_code, resp = http_post_json(f"{BASE_URL}/api/employees", emp, auth_headers)
            emp_data = resp.get("data", {})
            created_employees.append(emp_data)
            print(f"  [+] Employee: {emp_data.get('name')} | ID: {emp_data.get('employee_id')} | {emp.get('role')} ({emp.get('department_id')})")
        except urllib.error.HTTPError as he:
            err_body = json.loads(he.read().decode())
            if "already exists" in str(err_body):
                print(f"  [INFO] Employee with email '{emp['email']}' already exists.")
            else:
                print(f"  [ERROR] Employee creation error ({emp['email']}): {err_body}")

    # Step 4: Create Demonstration Digital Assets
    print("\n[STEP 4/5] Executing 7-Layer Verification Pipeline for Demonstration Assets...")
    assets_def = [
        # 1. Low Risk HR Policy
        {
            "filename": "Company_Policy_2026.pdf",
            "department": "Human Resources",
            "category": "Policy",
            "source": "Internal Policy",
            "content": "TrustSphere Global Corp Employee Conduct & Data Governance Policy 2026. Mandatory compliance with organizational security benchmarks and privacy protocols."
        },
        # 2. Low Risk HR Onboarding
        {
            "filename": "Employee_Joining_Document.pdf",
            "department": "Human Resources",
            "category": "Onboarding",
            "source": "HR System",
            "content": "TrustSphere Personnel Onboarding Protocol: Verification of professional credentials, intellectual property agreements, and code of ethics acknowledgment."
        },
        # 3. Low Risk Financial Report
        {
            "filename": "Quarterly_Financial_Report.pdf",
            "department": "Finance",
            "category": "Financial",
            "source": "Finance Department",
            "content": "TrustSphere Global Corp Q3 Financial Performance & Capital Allocation Overview 2026. Audited enterprise balance sheet and corporate investment summary."
        },
        # 4. Medium Risk Vendor Invoice
        {
            "filename": "Vendor_Invoice_September_2026.pdf",
            "department": "Finance",
            "category": "Invoice",
            "source": "Vendor Email",
            "content": "TrustSphere Vendor Invoice & Billing Notification: Invoice statement for September 2026. Payment required upon delivery. Bank account verification requested. Confidential payment terms."
        },
        # 5. Low Risk IT Security Report
        {
            "filename": "IT_Security_Audit_Report.pdf",
            "department": "Information Technology",
            "category": "Audit Report",
            "source": "Security System",
            "content": "Annual Infrastructure Hardening & Penetration Testing Assessment: Zero critical zero-day vulnerabilities detected across enclave perimeters and edge firewalls."
        },
        # 6. Medium Risk Access Request
        {
            "filename": "Employee_Access_Request.pdf",
            "department": "Information Technology",
            "category": "Access Management",
            "source": "Internal Request",
            "content": "Employee portal login verification. Internal security alert notice. Confidential access authorization form. Password and account review."
        },
        # 7. Low Risk Operations Report
        {
            "filename": "Operations_Compliance_Report.pdf",
            "department": "Operations",
            "category": "Compliance",
            "source": "Operations System",
            "content": "TrustSphere Operations & Supply Chain Protocol Compliance Audit: Verification of enterprise logistics, asset dispatch custody, and tracking integrity."
        },
        # 8. Low Risk Legal Certificate
        {
            "filename": "Legal_Compliance_Certificate.pdf",
            "department": "Legal & Compliance",
            "category": "Legal",
            "source": "Compliance Department",
            "content": "Enterprise Regulatory Certificate of Good Standing: Full conformance with national statutory regulations, corporate data privacy safeguards, and governance directives."
        },
        # 9. High Risk Synthetic Threat Document (Harmless Controlled Test)
        {
            "filename": "Synthetic_Security_Threat_Test.pdf",
            "department": "Information Technology",
            "category": "Threat Telemetry",
            "source": "Security System",
            "content": "URGENT SECURITY TEST - CONTROLLED DEMONSTRATION DOCUMENT. This is a controlled TrustSphere demonstration document. It contains suspicious keywords such as: urgent, immediately, password, wire transfer, verify account, payment required, security alert. This document is intentionally created to demonstrate risk detection."
        }
    ]

    verified_assets = []
    incidents_generated = []
    
    for asset in assets_def:
        pdf_bytes = generate_pdf(asset["content"])
        files = {"file": (asset["filename"], pdf_bytes, "application/pdf")}
        fields = {
            "department": asset["department"],
            "category": asset["category"],
            "source": asset["source"]
        }
        
        try:
            status_code, resp = http_post_multipart(f"{BASE_URL}/api/verify", fields=fields, files=files)
            data = resp.get("data", {})
            asset_id = data.get("asset_id") or resp.get("assetId")
            trust_score = data.get("trust_score") or resp.get("trustScore")
            risk = data.get("risk") or resp.get("risk")
            status_label = data.get("status") or resp.get("status")
            inc_id = data.get("incident_id") or resp.get("incidentId")
            
            verified_assets.append({
                "filename": asset["filename"],
                "asset_id": asset_id,
                "department": asset["department"],
                "trust_score": trust_score,
                "risk": risk,
                "status": status_label,
                "incident_id": inc_id
            })
            
            if inc_id:
                incidents_generated.append(inc_id)
                print(f"  [ALERT] Asset: {asset['filename']} -> Score: {trust_score}/100 [{risk}] -> Incident Generated: {inc_id}")
            else:
                print(f"  [OK] Asset: {asset['filename']} -> Score: {trust_score}/100 [{risk}] -> Status: {status_label}")
                
        except Exception as e:
            print(f"  [ERROR] Failed to verify asset '{asset['filename']}': {e}")

    # Step 5: Verify MongoDB and Metrics
    print("\n[STEP 5/5] Auditing MongoDB Live Database State & Telemetry...")
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    counts = {
        "users": db["users"].count_documents({}),
        "departments": db["departments"].count_documents({}),
        "employees": db["employees"].count_documents({}),
        "assets": db["assets"].count_documents({}),
        "asset_verifications": db["asset_verifications"].count_documents({}),
        "trust_scores": db["trust_scores"].count_documents({}),
        "incidents": db["incidents"].count_documents({}),
        "recommendations": db["recommendations"].count_documents({}),
        "audit_logs": db["audit_logs"].count_documents({})
    }
    
    print("\n  MongoDB Canonical Collection Record Counts:")
    for col_name, count in counts.items():
        print(f"    - {col_name:<20}: {count} records")

    # Fetch live dashboard metrics
    status_code, dash_resp = http_get(f"{BASE_URL}/api/dashboard/metrics")
    dash_metrics = dash_resp.get("data", {})
    
    print("\n  Dynamic Dashboard API Metrics:")
    print(f"    - Total Assets         : {dash_metrics.get('total_assets')}")
    print(f"    - Total Employees      : {dash_metrics.get('total_employees')}")
    print(f"    - Total Departments    : {dash_metrics.get('total_departments')}")
    print(f"    - Average Trust Score  : {dash_metrics.get('average_trust_score')}/100")
    print(f"    - Total Incidents      : {dash_metrics.get('total_incidents')}")
    print(f"    - Risk Breakdown       : {dash_metrics.get('risk_distribution')}")

    # Fetch digital twin topology overview
    status_code, twin_resp = http_get(f"{BASE_URL}/api/digital-twin/overview")
    twin_data = twin_resp.get("data", {})
    summary_data = twin_data.get("summary", {})
    
    print("\n  Digital Twin Real-Time Topology Telemetry:")
    print(f"    - Departments Loaded   : {summary_data.get('total_departments')}")
    print(f"    - Employees Loaded     : {summary_data.get('total_employees')}")
    print(f"    - Assets Loaded        : {summary_data.get('total_assets')}")
    print(f"    - Incidents Loaded     : {summary_data.get('total_incidents')}")
    print(f"    - Overall Twin Score   : {summary_data.get('overall_trust_score')}/100")

    # Save summary artifact
    summary = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "departments_count": counts["departments"],
        "employees_count": counts["employees"],
        "assets_count": counts["assets"],
        "risk_breakdown": dash_metrics.get("risk_distribution"),
        "incidents_count": counts["incidents"],
        "recommendations_count": counts["recommendations"],
        "audit_logs_count": counts["audit_logs"],
        "verified_assets": verified_assets
    }
    
    with open(r"C:\TrustSphere\DEMO_DATA_SUMMARY.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("\n" + "=" * 75)
    print("DEMO DATA INITIALIZATION COMPLETE — READY FOR MENTOR DEMONSTRATION")
    print("=" * 75)
    return True


if __name__ == "__main__":
    success = setup_demo_data()
    sys.exit(0 if success else 1)
