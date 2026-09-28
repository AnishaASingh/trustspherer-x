# TrustSphere Enterprise Deployment Guide
**On-Premises Single-Tenant Digital Asset Trust & Verification Platform**

---

## 1. What the Organization Installs
TrustSphere is designed to run entirely **inside your organization's private perimeter or internal cloud (VPC)**. No confidential enterprise documents or metadata are transmitted to third-party services.

The stack consists of three lightweight services:
1. **Frontend**: React application running on Vite or Nginx (default port `5173` or `80`).
2. **Backend**: FastAPI asynchronous Python service (default port `8000`).
3. **Database**: Local MongoDB service (`mongodb://localhost:27017`).

---

## 2. Quickstart with Docker Compose

Ensure Docker and Docker Compose are installed on your server:

```bash
# 1. Clone or copy TrustSphere into your target directory
cd /opt/TrustSphere  # or C:\TrustSphere on Windows

# 2. Copy the environment template
cp .env.example .env

# 3. Launch the complete containerized stack in background
docker compose up -d

# 4. Check service status
docker compose ps
```

The services will initialize automatically:
- MongoDB starts and configures internal storage volume `mongodb_data`.
- FastAPI backend starts, runs database indexing, and provisions the default administrator account.
- React frontend builds and serves the web console at `http://localhost:5173`.

---

## 3. Manual Local Deployment (Without Docker)

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- MongoDB Community Server running locally on `localhost:27017`

### Step-by-Step Launch

#### 1. Start MongoDB
Ensure MongoDB is running:
- **Windows**: `Start-Service -Name MongoDB` or `mongod --dbpath "C:\data\db"`
- **Linux/macOS**: `sudo systemctl start mongod`

#### 2. Start FastAPI Backend
```powershell
cd C:\TrustSphere\backend
C:\TrustSphere\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```
Backend API will be live at `http://localhost:8000`.

#### 3. Start React Frontend
```powershell
cd C:\TrustSphere
npm run dev -- --host 127.0.0.1 --port 5173
```
Frontend Web Console will be live at `http://localhost:5173`.

---

## 4. How the Administrator Logs In
Navigate to `http://localhost:5173/login`:
- **Email**: `admin@trustsphere.com`
- **Password**: `Admin@123`

The backend verifies the salted PBKDF2 hash stored in MongoDB, returns a signed JWT token, and redirects to the **Dashboard**.

---

## 5. How Departments and Employees are Created
1. **Departments**: Navigate to **Departments** in the sidebar. Click **"Add Department"**, specify the Department Name and Description, and click Submit.
2. **Employees**: Navigate to **Employees**. Click **"Add Employee"**, select the assigned Department, enter name, email, and security role.

---

## 6. How Manual Asset Upload Works
1. Click **"Upload Asset"** in the sidebar or Dashboard.
2. Select a supported file (`.pdf`, `.docx`, `.jpg`, `.png`).
3. Select the originating **Department**, document **Category**, and **Source**.
4. Click **"Start Verification"**.
5. The document is submitted to `POST /api/verify` as multipart `FormData`.
6. The teammate's 7-layer verification pipeline executes:
   - Layer 1: Cryptographic Block Hash (SHA-256)
   - Layer 2: Metadata Consistency Check
   - Layer 3: Document Structural Parsing
   - Layer 4: Content Threat Heuristics
   - Layer 5: Privacy & PII Detection
   - Layer 6: Isolation Forest Anomaly Analysis
   - Layer 7: Risk Engine & Trust Scoring
7. Results are persisted to MongoDB in `assets`, `asset_verifications`, `trust_scores`, and `recommendations`.
8. If the risk is High or Critical, an incident ticket is automatically created in `incidents`.

---

## 7. How Automatic Ingestion Works
TrustSphere includes an automated **watched-folder ingestion worker**:
- **Monitored Directory**: `./ingestion/incoming`
- **Processed Archive**: `./ingestion/processed`
- **Quarantine / Failed**: `./ingestion/failed`

When external systems, network scanners, or users drop documents into `incoming`:
1. The watcher detects the new file.
2. The SHA-256 block hash is computed.
3. **Duplicate Prevention**: If the hash already exists in `TrustSphereDB.assets`, the file is archived without duplicate database entries.
4. If new, it executes the identical 7-layer verification pipeline.
5. The resulting asset, score, verification record, and incidents are stored in MongoDB.
6. The file is moved to `./ingestion/processed`.

---

## 8. Dashboard and Live Digital Twin
- **Dashboard**: Consumes live metrics from `GET /api/dashboard/metrics`.
- **Digital Twin**: Dynamically aggregates the live organizational graph (`Enterprise Root → Departments → Personnel → Assets → Incidents`) via `GET /api/digital-twin/overview`. It reflects changes immediately upon database updates.

---

## 9. Stopping, Restarting, and Data Retention
- To stop the system:
  ```bash
  docker compose down
  ```
- **Data Persistence**: MongoDB stores data in the persistent volume `mongodb_data` (or local `C:\data\db`). Restarting the services or rebooting the server **does not lose any data**.
- To restart:
  ```bash
  docker compose up -d
  ```

---

## 10. Database Backup Instructions
To create a complete backup of the TrustSphere database:
```bash
# Export all 9 collections
mongodump --db TrustSphereDB --out ./backups/$(date +%Y%m%d_%H%M%S)

# To restore:
mongorestore --db TrustSphereDB ./backups/<backup_folder>/TrustSphereDB
```
