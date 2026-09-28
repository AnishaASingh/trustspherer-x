# TrustSphere — Enterprise Decision Trust Intelligence Platform

TrustSphere is a full-stack **Enterprise Decision Trust Intelligence Platform** built with **React + Vite** (Frontend), **FastAPI + Python** (Backend), **MongoDB (`TrustSphereDB`)**, **Isolation Forest Anomaly Detection**, **Automatic & Demo Email Ingestion**, and **Groq AI Decision Intelligence (`openai/gpt-oss-20b`)**.

---

## 🚀 Quick Start

### 1. Backend (FastAPI + MongoDB + Groq AI)
```powershell
cd C:\TrustSphere\backend
C:\TrustSphere\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```
- **API Base**: `http://localhost:8000`
- **Swagger UI**: `http://localhost:8000/docs`

### 2. Frontend (React + Vite)
```powershell
cd C:\TrustSphere\frontend
npm install
npm run dev
```
- **Frontend UI**: `http://localhost:5173`

---

## 🔑 Default Administrator Credentials

- **Email**: `admin@trustsphere.com`
- **Password**: `Admin@123`

*(Note: `admin@trustsphere.com` is the TrustSphere platform administrator login. It is not automatically treated as a monitored organization email inbox.)*

---

## ⚙️ Environment Configuration (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and configure:

```env
MONGO_URL=mongodb://localhost:27017
DATABASE_NAME=TrustSphereDB
JWT_SECRET=your_jwt_secret_here

# Groq AI Decision Intelligence
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b

# Optional Gmail OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:8000/api/ingestion/email/oauth/callback
EMAIL_POLL_INTERVAL_SECONDS=60
```

See [AI_EMAIL_INTEGRATION.md](file:///C:/TrustSphere/AI_EMAIL_INTEGRATION.md) for complete documentation on Groq AI Decision Intelligence, API key security, Gmail OAuth, Email Safety & Filtering Rules, and Demo Email Ingestion.

---

## 🛡️ Core Modules & Routes

| Route | Module | Description |
|---|---|---|
| `/` | **Landing Page** | Enterprise cyber-security hero and interactive topology showcase |
| `/login` | **Authentication Console** | JWT authentication against MongoDB `users` collection |
| `/dashboard` | **SOC Security Dashboard** | Live KPIs, Trust Trend, Risk Donut, Department Benchmarks, and integrated **TrustSphere AI Security Assistant** |
| `/assets` | **Digital Assets Registry** | Searchable/filterable asset inventory with trust scores, risk levels, and CSV export |
| `/assets/:id` | **Asset Details** | 7-layer diagnostics, SHA-256 digest, Email provenance, and **`[AI Explain Analysis]`** (`POST /api/ai/analyze-asset`) |
| `/upload` | **Manual Asset Upload** | Drag-and-drop file upload through the 7-layer verification + Groq AI pipeline |
| `/email-integration` | **Email Integration** | **REAL MODE** (Gmail OAuth 2.0), **Email Safety & Filtering Policy**, and clearly labelled **DEMO MODE** (`Demo Email Ingestion`) |
| `/ai-assistant` | **AI Security Assistant** | Context-grounded AI analyst (`POST /api/ai/chat`) for assets, incidents, departments, and Digital Twin |
| `/trust-analysis` | **Trust Analysis** | Multi-factor radar and layer-by-layer verification breakdown |
| `/incidents` | **Security Incidents** | Automated High/Critical risk incident triage queue |
| `/incidents/:id` | **Incident Details** | Forensic timeline, status transitions, and **`[AI Analyze Incident]`** (`POST /api/ai/analyze-incident`) |
| `/employees` | **Employees** | Personnel directory with trust scores and department associations |
| `/departments` | **Departments** | Departmental trust scorecards and governance metrics |
| `/digital-twin` | **Digital Twin** | Live interactive organizational graph + **`[AI Analyze Organization]`** (`POST /api/ai/analyze-digital-twin`) |
| `/reports` | **Reports** | Executive decision trust reporting with PDF/Print and CSV export |
| `/audit-logs` | **Audit Logs** | Tamper-evident MongoDB activity log across all user, AI, and ingestion events |
| `/users` | **User Management** | Admin-only user lifecycle management (Add, Edit, Role, Activate/Deactivate, Reset Password, Delete) |
