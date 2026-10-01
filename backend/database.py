import os
import sys
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, PyMongoError

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Load environment variables from backend/.env
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

# ============================================================
# CONFIGURATION VIA ENVIRONMENT VARIABLES
# ============================================================

MONGODB_URL = (
    os.environ.get("MONGODB_URL")
    or os.environ.get("MONGODB_URI")
    or "mongodb://localhost:27017"
)
MONGODB_DATABASE = os.environ.get("MONGODB_DATABASE", "TrustSphereDB")

# Global singleton client and database instances
_client: Optional[MongoClient] = None
_db: Optional[Database] = None


# ============================================================
# DATABASE ACCESS HELPERS
# ============================================================

def get_client() -> MongoClient:
    """
    Returns or creates the synchronous MongoClient singleton.
    """
    global _client
    if _client is None:
        client_kwargs = {
            "serverSelectionTimeoutMS": 5000,
            "connectTimeoutMS": 5000,
        }
        if "mongodb+srv" in MONGODB_URL or "ssl=true" in MONGODB_URL.lower():
            try:
                import certifi
                client_kwargs["tlsCAFile"] = certifi.where()
            except Exception:
                pass
        _client = MongoClient(
            MONGODB_URL,
            **client_kwargs
        )
    return _client


def get_database() -> Database:
    """
    Returns the TrustSphereDB database instance.
    """
    global _db
    if _db is None:
        client = get_client()
        _db = client[MONGODB_DATABASE]
    return _db


# ============================================================
# CORE COLLECTIONS ACCESS (EXACTLY 9 COLLECTIONS)
# ============================================================

def get_collection(name: str):
    return get_database()[name]

def get_users_collection():
    return get_collection("users")

def get_departments_collection():
    return get_collection("departments")

def get_employees_collection():
    return get_collection("employees")

def get_assets_collection():
    return get_collection("assets")

def get_verifications_collection():
    return get_collection("asset_verifications")

def get_trust_scores_collection():
    return get_collection("trust_scores")

def get_incidents_collection():
    return get_collection("incidents")

def get_recommendations_collection():
    return get_collection("recommendations")

def get_audit_logs_collection():
    return get_collection("audit_logs")

def get_email_integrations_collection():
    return get_collection("email_integrations")


# ============================================================
# HEALTH CHECK HELPER
# ============================================================

def check_db_connection() -> Dict[str, Any]:
    """
    Tests MongoDB connection and returns connectivity status dictionary.
    """
    try:
        client = get_client()
        # Ping the server
        client.admin.command('ping')
        db = get_database()
        collections = db.list_collection_names()
        return {
            "status": "connected",
            "database": MONGODB_DATABASE,
            "url": MONGODB_URL.split("@")[-1], # Mask credentials if any
            "collections_count": len(collections)
        }
    except Exception as exc:
        return {
            "status": "error",
            "database": MONGODB_DATABASE,
            "error": str(exc)
        }


# ============================================================
# DATABASE INITIALIZATION & INDEXES (PHASE 1H & PHASE 2 SECTION 14)
# ============================================================

def init_db():
    """
    Initializes database indexes and seeds basic reference records if empty.
    """
    try:
        db = get_database()

        # 1. users: unique email
        db.users.create_index([("email", ASCENDING)], unique=True, sparse=True)

        # 2. employees: unique employee_id, email and department_id indexes
        db.employees.create_index([("employee_id", ASCENDING)], unique=True, sparse=True)
        db.employees.create_index([("email", ASCENDING)])
        db.employees.create_index([("department_id", ASCENDING)])

        # 3. departments: unique name
        db.departments.create_index([("name", ASCENDING)], unique=True, sparse=True)

        # 4. assets: unique asset_id, file_hash, department_id, created_at
        db.assets.create_index([("asset_id", ASCENDING)], unique=True)
        db.assets.create_index([("file_hash", ASCENDING)])
        db.assets.create_index([("department_id", ASCENDING)])
        db.assets.create_index([("created_at", DESCENDING)])
        db.assets.create_index([("upload_date", DESCENDING)])

        # 5. asset_verifications: asset_id index
        db.asset_verifications.create_index([("asset_id", ASCENDING)])
        db.asset_verifications.create_index([("verification_id", ASCENDING)], unique=True)

        # 6. trust_scores: asset_id index
        db.trust_scores.create_index([("asset_id", ASCENDING)])

        # 7. incidents: unique incident_id, asset_id, status, severity, created_at
        db.incidents.create_index([("incident_id", ASCENDING)], unique=True)
        db.incidents.create_index([("asset_id", ASCENDING)])
        db.incidents.create_index([("department_id", ASCENDING)])
        db.incidents.create_index([("status", ASCENDING)])
        db.incidents.create_index([("severity", ASCENDING)])
        db.incidents.create_index([("created_at", DESCENDING)])

        # 8. recommendations: asset_id index
        db.recommendations.create_index([("asset_id", ASCENDING)])
        db.recommendations.create_index([("recommendation_id", ASCENDING)], unique=True)

        # 9. audit_logs: timestamp index
        db.audit_logs.create_index([("timestamp", DESCENDING)])

        # 10. email_integrations: organization_id and provider index
        db.email_integrations.create_index([("organization_id", ASCENDING), ("provider", ASCENDING)], unique=True, sparse=True)

        # Ensure default ADMIN account exists (Part 2)
        admin_email = "admin@trustsphere.com"
        existing_admin = db.users.find_one({"email": admin_email})
        if not existing_admin:
            from utils.security import hash_password
            from datetime import datetime
            now_iso = datetime.utcnow().isoformat()
            admin_doc = {
                "name": "TrustSphere Admin",
                "email": admin_email,
                "password_hash": hash_password("Admin@123"),
                "role": "ADMIN",
                "created_at": now_iso,
                "updated_at": now_iso
            }
            db.users.insert_one(admin_doc)
            print(f"[TrustSphere DB] Default ADMIN account initialized: {admin_email}")

        print("[TrustSphere DB] Initialized MongoDB connections and indexes successfully.")
        return True
    except Exception as exc:
        print(f"[TrustSphere DB] Error initializing MongoDB: {exc}")
        return False
