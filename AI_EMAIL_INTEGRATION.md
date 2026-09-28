# TrustSphere — Groq AI Decision Intelligence & Automatic Email Ingestion Guide

## 1. Architectural Overview

TrustSphere integrates two enterprise intelligence capabilities on top of its core **7-Layer Verification Pipeline**, **MongoDB (`TrustSphereDB`)**, and **Organizational Digital Twin**:

1. **AI Decision Intelligence Layer (`Groq Cloud API` + `openai/gpt-oss-20b`)**
2. **Automatic & Demo Email Ingestion Gateway (`Google OAuth 2.0` + `Demo Email Ingestion` + Safety Filtering)**

```text
MANUAL FILE UPLOAD                         ORGANIZATION EMAIL INGESTION
(UploadAsset.jsx)                          (Gmail OAuth 2.0 OR Demo Email Mode)
        │                                                  │
        ▼                                                  ▼
File Validator                              Email Safety & Filtering Policy
(.pdf, .docx, .xlsx, .png, .jpg, .txt)      (Sender, Keywords, Size, Duplicate Message-ID)
        │                                                  │
        └──────────────────────┬───────────────────────────┘
                               ▼
            7-LAYER TRUSTSPHERE VERIFICATION PIPELINE
            1. Cryptographic File Integrity (SHA-256)
            2. Metadata Consistency Analysis
            3. Document Structure Inspection (PDF/DOCX/XLSX/Image/TXT)
            4. Content Threat Heuristics
            5. Privacy & PII Detection
            6. Isolation Forest Anomaly Detection
            7. Multi-Factor Risk & Trust Scoring Engine
                               │
                               ▼
              GROQ AI DECISION INTELLIGENCE LAYER
              Model: openai/gpt-oss-20b (Structured JSON)
              Separates: FACTS | INFERENCES | RECOMMENDATIONS
                               │
                               ▼
              MONGODB PERSISTENCE & DIGITAL TWIN
              (assets, asset_verifications, trust_scores,
               recommendations, incidents, audit_logs,
               email_integrations)
```

---

## 2. How Groq AI Works (`openai/gpt-oss-20b`)

- **Model**: `openai/gpt-oss-20b` accessed via Groq's OpenAI-compatible endpoint (`https://api.groq.com/openai/v1/chat/completions`).
- **Pretrained Model + Controlled Context (No Fine-Tuning Claim)**:
  - The LLM is **not** trained or fine-tuned on TrustSphere data.
  - Instead, TrustSphere queries real records from MongoDB (`assets`, `asset_verifications`, `trust_scores`, `incidents`, `departments`, `employees`, `recommendations`) and passes them as structured JSON telemetry to `openai/gpt-oss-20b` under a strict **Controlled System Prompt** (`TRUSTSPHERE_SYSTEM_PROMPT`).
- **Hallucination Prevention & Fact Separation**:
  - The system prompt instructs the model to rely **only** on the supplied TrustSphere database telemetry, never invent assets/incidents/departments, and explicitly separate:
    - `facts`: Observed telemetry from the 7-layer pipeline and MongoDB.
    - `inferences`: Analytical conclusions derived from those facts.
    - `recommendations`: Concrete, prioritized security governance actions.
- **Structured JSON Output & Validation**:
  - Every AI response is validated and normalized into a guaranteed schema:
    ```json
    {
      "summary": "Concise executive security summary",
      "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
      "key_findings": ["Finding 1", "Finding 2"],
      "reasoning": "Clear explanation separating facts from inferences",
      "recommendations": ["Action 1", "Action 2"],
      "facts": ["Observed fact 1"],
      "inferences": ["Analytical inference 1"]
    }
    ```

### Authenticated AI Endpoints (`backend/routers/ai.py`)
All `/api/ai/*` endpoints require a valid JWT Bearer token (`Depends(get_current_user)`):
- `GET /api/ai/status` — Returns Groq API readiness and model telemetry.
- `POST /api/ai/analyze-asset` — Analyzes a verified asset (`asset_id`) and returns structured explanations.
- `POST /api/ai/analyze-incident` — Performs root-cause and remediation analysis for an incident (`incident_id`).
- `POST /api/ai/analyze-digital-twin` — Analyzes cross-department risk distribution across the Digital Twin.
- `POST /api/ai/chat` — Controlled TrustSphere AI Security Assistant grounded in live MongoDB records.

---

## 3. How API Keys & Secrets Are Stored Safely

1. **Backend Environment Only (`backend/.env`)**:
   - `GROQ_API_KEY` and `GROQ_MODEL=openai/gpt-oss-20b` are stored exclusively in `C:\TrustSphere\backend\.env`.
2. **Zero Frontend Exposure**:
   - The Groq API key is **never** placed in `frontend/.env` (`VITE_*`) and is **never** returned by any API endpoint. All Groq requests happen server-side in FastAPI (`backend/services/ai_intelligence.py`).
3. **Git Protection**:
   - `.gitignore` excludes `.env`, `backend/.env`, and `frontend/.env`.
   - `backend/.env.example` contains only safe placeholder strings (`your_groq_api_key_here`).

---

## 4. How Fallback Works When Groq Is Unavailable

If `GROQ_API_KEY` is missing, invalid, rate-limited, or unreachable:
- `backend/services/ai_intelligence.py` automatically catches the error and switches to its **Deterministic Heuristic Fallback Engine** (`_build_fallback_asset_insights` / `_validate_and_normalize_ai_response`).
- The fallback engine synthesizes a complete, schema-compliant JSON response directly from the 7-layer verification scores, detected keywords, PII counts, and Isolation Forest status, marking `"is_live_llm": false` so the UI never crashes or hangs.

---

## 5. How OAuth Email Integration & Safety Filtering Work

### Crucial Identity Separation
- `admin@trustsphere.com` is the **TrustSphere platform administrator login**, **not** an automatically monitored mailbox.
- By default, the mailbox status in MongoDB (`email_integrations` collection) is **`Not Connected`**.

### MongoDB `email_integrations` Collection Schema
- `_id`: Document ID
- `organization_id`: `"ORG-TRUSTSPHERE"`
- `provider`: `"gmail"`
- `email_address`: Connected mailbox address (or `null` when `Not Connected`)
- `status`: `"Not Connected"` or `"Connected"`
- `oauth_reference`: Non-reversible SHA-256 reference token (`oauth2_ref_...`), never plain-text secrets
- `filter_rules`: Configurable safety & filtering policy
- `last_sync_at`, `created_at`, `updated_at`

### Email Safety & Filtering Policy
Before any incoming email or attachment is processed, `evaluate_email_safety_and_filters()` checks:
1. **Duplicate `Message-ID` Prevention**: Skips emails whose `Message-ID` has already been processed in MongoDB.
2. **Allowed Senders Filter**: Optional allowlist of sender addresses or domains.
3. **Subject Keywords Filter**: Optional list of required subject keywords.
4. **Attachment Requirement**: Optional policy requiring an attachment.
5. **Allowed File Extensions & Size Validation**: Permits `.pdf`, `.docx`, `.xlsx`, `.png`, `.jpg`, `.jpeg`, `.txt` up to `max_file_size_mb` (default 10 MB) and rejects unsafe extensions (such as `.exe`, `.bat`, `.sh`, `.js`).

---

## 6. How Demo Email Ingestion Works

When Google Cloud OAuth credentials (`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`) are not configured in `backend/.env`:
- TrustSphere **honestly reports** `Status: Not Connected` and does **not** fake a live Gmail connection.
- Administrators and evaluators can use the clearly labelled **Demo Email Ingestion** mode (`POST /api/ingestion/email/demo`) on the **Email Integration** page (`/email-integration`):
  - Specify **Sender Email**, **Subject**, **Optional Body**, **Attachment File**, **Target Department**, and optional **Message-ID**.
  - The demo email goes through the **exact same** Safety Filter → File Validator → 7-Layer Verification Pipeline → Groq AI Analysis → Recommendation → Incident Creation (if High/Critical) → Audit Log → Digital Twin update.
  - Every resulting asset and event is transparently tagged with `is_demo: true` and `ingestion_mode: "DEMO"` in both MongoDB and the React UI.

---

## 7. How to Test AI & Email Ingestion

1. **Start Backend**:
   ```powershell
   cd C:\TrustSphere\backend
   C:\TrustSphere\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```
2. **Start Frontend**:
   ```powershell
   cd C:\TrustSphere\frontend
   npm run dev
   ```
3. **Log In**:
   - Open `http://localhost:5173/login` and sign in as `admin@trustsphere.com` / `Admin@123`.
4. **Test AI Decision Intelligence**:
   - **Dashboard (`/dashboard`)**: Use the **TrustSphere AI Security Assistant** card or click any preset question.
   - **AI Assistant (`/ai-assistant`)**: Test context-grounded queries across Dashboard, Digital Twin, Specific Asset, or Specific Incident.
   - **Asset Details (`/assets/:id`)**: Click **`[AI Explain Analysis]`**.
   - **Incident Details (`/incidents/:id`)**: Click **`[AI Analyze Incident]`**.
   - **Digital Twin (`/digital-twin`)**: Click **`[AI Analyze Organization]`**.
5. **Test Email Ingestion**:
   - Navigate to **Email Integration (`/email-integration`)**.
   - Verify OAuth status shows `Not Connected` (and clicking `Connect Gmail` honestly informs if Google OAuth credentials are not configured).
   - Click **`[Demo Email Ingestion]`**, attach a `.pdf`, `.docx`, `.xlsx`, `.png`, or `.txt` file, and submit to watch it flow through the 7-layer pipeline, Groq AI, Incidents, Audit Logs, and Digital Twin.
