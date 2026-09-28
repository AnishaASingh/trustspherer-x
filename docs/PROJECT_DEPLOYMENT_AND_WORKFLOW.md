# TrustSphere — Enterprise Deployment & Operational Workflow Guide

```
========================================================================================
TRUSTSPHERE ENTERPRISE TRUST & RISK INTELLIGENCE PLATFORM
Authoritative Production Architecture, Deployment, and Operations Manual
Document Version: 2.0.0 | Release Phase: Phase 4 Production-Ready
========================================================================================
```

---

## 1. System Architecture Overview

TrustSphere is a high-assurance cybersecurity intelligence platform designed to evaluate, verify, and monitor organizational digital assets, personnel risk, and threat propagation across enterprise topologies.

### Architectural Tiers

```
   ┌────────────────────────────────────────────────────────┐
   │             TRUSTSPHERE REACT/VITE FRONTEND            │
   │               Port: 5173 (Dev) / 80 (Nginx)            │
   │   - Dark Cyber Theme (#0B0F19 background)              │
   │   - Unified Single-Tenant Governance Console           │
   │   - Interactive Live Digital Twin Topology             │
   │   - Real-Time Risk & Verification Telemetry            │
   └───────────────────────────┬────────────────────────────┘
                               │ HTTP / JSON / Multipart
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │                 FASTAPI BACKEND SERVICE                │
   │               Port: 8000 / Uvicorn ASGI                │
   │   - PBKDF2-HMAC-SHA256 Token Auth & RBAC               │
   │   - Authoritative 7-Layer Verification Pipeline        │
   │   - Automatic Watched-Folder Ingestion Daemon          │
   │   - Extensible IMAP Email Intake Adapter               │
   │   - Cryptographic SHA-256 Duplicate Prevention         │
   └───────────────────────────┬────────────────────────────┘
                               │ PyMongo 4.x Connection Pool
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │              MONGODB TRUSTSPHEREDB CLUSTER             │
   │                      Port: 27017                       │
   │   Strict Canonical Schema: Exactly 9 Collections       │
   │   1. users                6. trust_scores              │
   │   2. departments          7. incidents                 │
   │   3. employees            8. recommendations           │
   │   4. assets               9. audit_logs                │
   │   5. asset_verifications                               │
   └────────────────────────────────────────────────────────┘
```

---

## 2. Single-Tenant Organizational Deployment Model

TrustSphere operates exclusively as an **Isolated Single-Tenant Instance** per enterprise deployment:
1. **Organizational Boundary**: Every running instance represents one designated enterprise (e.g., `TrustSphere Global Corp`).
2. **Zero Multitenancy Overhead**: No cross-tenant data leaks, organizational ID partitioning bugs, or external data co-mingling.
3. **Pristine State Guarantee**: Deployments ship with zero synthetic, mock, or regional demo data. The single initial identity is the authorized Enterprise Security Administrator (`admin@trustsphere.com`).
4. **Data Isolation**: Departmental, employee, asset, incident, and audit records reside in dedicated, local collections under `TrustSphereDB`.

---

## 3. Authoritative 7-Layer Verification Pipeline

Both manual uploads (`POST /api/verify`) and automatic intake (watched folder & email) execute the identical cryptographic and algorithmic verification pipeline:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│              UNIFIED 7-LAYER TRUST EVALUATION & ENCLAVE PIPELINE                │
├──────┬───────────────────────┬──────────────────────────────────────────────────┤
│ L1   │ File Integrity        │ SHA-256 block hash computation & collision check │
├──────┼───────────────────────┼──────────────────────────────────────────────────┤
│ L2   │ Metadata Analysis     │ Header consistency, MIME validation, byte ratios │
├──────┼───────────────────────┼──────────────────────────────────────────────────┤
│ L3   │ Document Structure    │ PDF, DOCX, Image, Text structural compliance     │
├──────┼───────────────────────┼──────────────────────────────────────────────────┤
│ L4   │ Content Analysis      │ Phishing terms, suspicious URLs, credential cues │
├──────┼───────────────────────┼──────────────────────────────────────────────────┤
│ L5   │ Privacy / PII Check   │ Aadhaar, PAN, Credit Cards, Phones, IP addresses │
├──────┼───────────────────────┼──────────────────────────────────────────────────┤
│ L6   │ Anomaly Detection     │ Isolation Forest structural feature deviation    │
├──────┼───────────────────────┼──────────────────────────────────────────────────┤
│ L7   │ Risk Engine           │ Weighted 0-100 composite trust & risk scoring    │
└──────┴───────────────────────┴──────────────────────────────────────────────────┘
```

### Risk Classification Thresholds
- **Score 80–100 (Low Risk)**: Status `VERIFIED` — No critical indicators; normal asset lifecycle.
- **Score 60–79 (Medium Risk)**: Status `UNDER REVIEW` — Minor warnings; compliance triage recommended.
- **Score 30–59 (High Risk)**: Status `FLAGGED` — Automated Security Incident generated (`INC-XXXXXX`). Dual custody validation required.
- **Score 0–29 (Critical Risk)**: Status `REJECTED` — Automated Security Incident generated (`INC-XXXXXX`). Enclave quarantine enforced.

---

## 4. Dual-Mode Ingestion Architecture

TrustSphere supports both on-demand human uploads and automated enterprise background intake:

### A. Manual Interactive Uploads
- Initiated from the React frontend (`/upload`) via `POST /api/verify`.
- Validates mime type, runs the 7 layers, stores the asset, and returns complete visual telemetry to the browser.

### B. Automated Watched-Folder Ingestion
- **Directory Layout**:
  - `ingestion/incoming/`: Ingest drop target for scannable assets (`.pdf`, `.docx`, `.png`, `.jpg`, `.txt`).
  - `ingestion/processed/`: Secure enclave holding successfully processed assets (prefixed by UTC timestamp).
  - `ingestion/failed/`: Isolated quarantine containing corrupted or unparseable files with accompanied `.error.txt` diagnostic logs.
- **Background Daemon**: Runs every 5 seconds inside the FastAPI lifespan, polling `incoming/` for stabilized files.
- **On-Demand Scan**: Can be triggered immediately via `POST /api/ingestion/scan`.

### C. Cryptographic Duplicate Prevention
- Prior to entering the verification pipeline, the file's SHA-256 checksum is calculated.
- The pipeline queries `db.assets.find_one({"file_hash": file_hash})`.
- If an asset with the identical hash already exists:
  1. The pipeline skips redundant verification.
  2. No duplicate documents are inserted into `assets`, `incidents`, or `trust_scores`.
  3. An audit record is logged: `action: "DUPLICATE_ASSET_SKIPPED"`.
  4. In watched-folder mode, the duplicate file is cleanly transitioned to `processed/` to keep `incoming/` clean.

### D. IMAP Email Ingestion Service
- Located at `backend/services/email_ingestion.py`.
- Connects to enterprise mail server via TLS/SSL (`IMAP_SERVER`, `IMAP_PORT=993`).
- Polls for `UNSEEN` messages containing valid attachments.
- Automatically pushes attachments through the 7-layer pipeline with `source="Email Ingestion (<sender>)"`.
- Safe fallback: If disabled (`EMAIL_INGESTION_ENABLED=false`) or credentials are absent, the service logs an informational notice and idles without throwing unhandled exceptions or disrupting FastAPI.

---

## 5. Production Docker Deployment

### Prerequisites
- Docker Engine 24.0+
- Docker Compose v2.20+
- 4 GB RAM, 2 CPU Cores, 20 GB free disk space

### Quick Start
1. Clone the repository and navigate to the project root:
   ```bash
   cd C:\TrustSphere
   ```
2. Configure production secrets in `.env`:
   ```bash
   cp .env.example .env
   ```
3. Build and launch all containerized microservices:
   ```bash
   docker compose up -d --build
   ```
4. Confirm health status:
   ```bash
   docker compose ps
   curl http://localhost:8000/api/health
   ```
5. Access the user interface at `http://localhost`.

---

## 6. API Reference Summary

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/health` or `/api/health` | Comprehensive MongoDB and backend health telemetry | No |
| `POST` | `/api/auth/login` | Authenticate with email and password to receive JWT | No |
| `GET` | `/api/auth/me` | Fetch active user identity and role from JWT | Yes (Bearer) |
| `POST` | `/api/verify` | Upload file and run 7-layer verification pipeline | Optional |
| `GET` | `/api/assets` | Retrieve digital assets with optional filtering | Optional |
| `GET` | `/api/assets/{id}` | Retrieve asset detail and layer scores | Optional |
| `GET` | `/api/incidents` | List detected threat incidents | Optional |
| `PATCH`| `/api/incidents/{id}` | Update incident lifecycle status | Optional |
| `GET` | `/api/departments` | List enterprise organizational departments | Optional |
| `POST` | `/api/departments` | Register a new organizational department | Optional |
| `GET` | `/api/employees` | List registered personnel | Optional |
| `POST` | `/api/employees` | Register a new employee | Optional |
| `GET` | `/api/dashboard/metrics` | Live metrics computed directly from MongoDB | Optional |
| `GET` | `/api/digital-twin/topology`| Node-and-link topological graph structure | Optional |
| `GET` | `/api/ingestion/status` | Ingestion daemon telemetry and queue counts | Optional |
| `POST` | `/api/ingestion/scan` | Trigger manual scan of `ingestion/incoming/` | Optional |
| `GET` | `/api/ingestion/history` | List recent file ingestion audit events | Optional |
| `POST` | `/api/ingestion/email/poll`| Force on-demand check of configured IMAP inbox | Optional |

---

## 7. Database Maintenance & Sanitization

To restore the MongoDB database to a pristine zero-demo-data state containing only the default administrator:

```bash
# Dry run to inspect records
python scripts/cleanup_test_data.py --dry-run

# Execute full cleanup
python scripts/cleanup_test_data.py --execute
```

This guarantees:
- All 9 canonical collections exist with proper indexes.
- Exactly 1 record remains in `users` (`admin@trustsphere.com`).
- Zero residual records in `departments`, `employees`, `assets`, `asset_verifications`, `trust_scores`, `incidents`, `recommendations`, `audit_logs`.
