# TrustSphere — Setup Guide for Teammate (Windows)

Follow these steps in order to set up and run the exact **TrustSphere** environment on your Windows laptop.

---

## 1. Install Prerequisites

1. **Install Python (3.10+)**
   - Download from [https://www.python.org/downloads/windows/](https://www.python.org/downloads/windows/)
   - During installation, check **"Add python.exe to PATH"**.
   - Verify in PowerShell:
     ```powershell
     python --version
     ```

2. **Install Node.js (v18+ LTS recommended)**
   - Download from [https://nodejs.org/](https://nodejs.org/)
   - Verify in PowerShell:
     ```powershell
     node --version
     npm --version
     ```

3. **Install MongoDB Community Server (Local `localhost:27017`)**
   - Download **MongoDB Community Server (MSI)** from [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
   - During installation, keep **"Install MongoD as a Service"** checked (default port `27017`).
   - *(Optional)* Install **MongoDB Database Tools** (`mongodump` / `mongorestore`) from [https://www.mongodb.com/try/download/database-tools](https://www.mongodb.com/try/download/database-tools) or via Winget:
     ```powershell
     winget install --id MongoDB.DatabaseTools
     ```
     *(Note: `restore_database.ps1` works both with `mongorestore.exe` and via a built-in Python/PyMongo BSON fallback if Database Tools are not installed.)*

---

## 2. Clone the GitHub Repository

Open PowerShell and clone the repository to `C:\TrustSphere` (or your preferred folder):

```powershell
git clone <YOUR_GITHUB_REPO_URL> C:\TrustSphere
cd C:\TrustSphere
```

---

## 3. Create & Activate Python Virtual Environment

From `C:\TrustSphere`:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

*(If PowerShell blocks script execution, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first.)*

---

## 4. Install Backend Requirements

With the virtual environment activated:

```powershell
pip install -r .\backend\requirements.txt
```

---

## 5. Install Frontend Dependencies

```powershell
cd C:\TrustSphere\frontend
npm install
cd C:\TrustSphere
```

---

## 6. Restore the MongoDB Database (`TrustSphereDB`)

Ensure the MongoDB Windows service is running (`localhost:27017`), then run the restore script from `C:\TrustSphere`:

```powershell
powershell -ExecutionPolicy Bypass -File .\restore_database.ps1
```

What this restores into **`TrustSphereDB`**:
- `assets` (87 documents)
- `asset_verifications` (87 documents)
- `audit_logs` (330 documents)
- `departments` (11 documents)
- `email_integrations` (1 document)
- `employees` (14 documents)
- `incidents` (13 documents)
- `recommendations` (87 documents)
- `trust_scores` (87 documents)
- `users` (7 documents)

---

## 7. Configure Backend `.env` (`C:\TrustSphere\backend\.env`)

1. Copy the template file `backend\.env.example` to `backend\.env`:
   ```powershell
   Copy-Item .\backend\.env.example .\backend\.env
   ```

2. Open `C:\TrustSphere\backend\.env` in your code editor and configure your keys:
   ```env
   MONGODB_URL=mongodb://localhost:27017
   MONGODB_DATABASE=TrustSphereDB

   JWT_SECRET=replace_with_strong_random_jwt_secret
   JWT_ALGORITHM=HS256
   JWT_EXPIRATION_MINUTES=1440
   CORS_ORIGIN=http://localhost:5173

   # Groq AI Configuration (OpenAI-compatible endpoint: https://api.groq.com/openai/v1)
   GROQ_API_KEY=your_groq_api_key_here
   GROQ_MODEL=openai/gpt-oss-20b

   # Google / Gmail OAuth 2.0 Configuration for Automatic Organization Mailbox Ingestion
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   GOOGLE_REDIRECT_URI=http://localhost:8000/api/ingestion/email/oauth/callback

   # Email Ingestion Poll Interval & Safety Defaults
   EMAIL_POLL_INTERVAL_SECONDS=60
   EMAIL_INGESTION_ENABLED=false
   EMAIL_ANALYSIS_MODE=both
   ```

### Important Security Notes on API Keys & OAuth Credentials
- **Where to add `GROQ_API_KEY`**: Paste your own Groq Cloud API key (`gsk_...`) into `GROQ_API_KEY=` inside `C:\TrustSphere\backend\.env`. Never put `GROQ_API_KEY` inside `frontend\.env` or commit it to GitHub. (If `GROQ_API_KEY` is left blank, TrustSphere automatically uses its built-in deterministic heuristic fallback so all pages still work.)
- **Gmail OAuth Credentials (`GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`)**: These are optional and separate per developer/environment. They must **never** be committed to GitHub. When left empty, TrustSphere honestly displays `Status: Not Connected` for live Gmail OAuth while allowing full end-to-end testing via **Demo Email Ingestion**.

---

## 8. Start the Backend & Frontend

Open **two separate PowerShell terminals**:

### Terminal 1 — Start FastAPI Backend (Port `8000`)
```powershell
cd C:\TrustSphere\backend
C:\TrustSphere\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Terminal 2 — Start React + Vite Frontend (Port `5173`)
```powershell
cd C:\TrustSphere\frontend
npm run dev
```

---

## 9. Application URLs & Default Login

- **Frontend Application**: [http://localhost:5173](http://localhost:5173)
- **FastAPI Backend Base URL**: [http://localhost:8000](http://localhost:8000)
- **FastAPI Swagger API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

### Default Administrator Login (Already Seeded in `TrustSphereDB`)
- **Email**: `admin@trustsphere.com`
- **Password**: `Admin@123`

---

## 10. How to Verify All Core Features Work

After logging in at `http://localhost:5173/login` with `admin@trustsphere.com` / `Admin@123`:

1. **SOC Security Dashboard (`/dashboard`)**
   - Verify live KPI cards (Total Assets, Average Trust Score, Active Incidents, High-Risk Assets), Trust Trend chart, Risk Distribution donut, and Department Benchmarks load from `TrustSphereDB`.
2. **Digital Assets Registry (`/assets` & `/assets/:id`)**
   - Open **Assets** to see the restored assets, filter by Risk/Department, and click any asset to inspect its **7-Layer Verification Breakdown**, SHA-256 hash, and click **`[AI Explain Analysis]`**.
3. **Groq AI Decision Intelligence (`/ai-assistant`, Asset Details, Incident Details)**
   - Open **AI Assistant (`/ai-assistant`)** or use the Dashboard AI widget to ask a security question (e.g., *"Which department has the highest risk?"*).
   - If `GROQ_API_KEY` is set in `backend\.env`, verify live `openai/gpt-oss-20b` responses return structured `facts`, `inferences`, and `recommendations`.
4. **Organizational Digital Twin (`/digital-twin`)**
   - Open **Digital Twin** to view the interactive topology graph of departments, employees, assets, and incidents.
   - Click **`[AI Analyze Organization]`** to run cross-department Digital Twin risk analysis.
5. **Email Integration & Demo Email Ingestion (`/email-integration`)**
   - Open **Email Integration**. Confirm OAuth status shows `Not Connected` by default.
   - Use the **Demo Email Ingestion** panel: enter a sender email, subject, select a department, attach a sample `.txt`, `.pdf`, `.docx`, `.xlsx`, or `.png` file, and submit.
   - Verify that the ingested email attachment goes through the 7-layer pipeline, updates Assets, Audit Logs, Digital Twin, and creates an Incident if High/Critical risk.
