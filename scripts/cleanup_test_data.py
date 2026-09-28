import os
import sys
import argparse
from datetime import datetime
from pymongo import MongoClient

MONGODB_URL = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DATABASE = os.environ.get("MONGODB_DATABASE", "TrustSphereDB")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
UPLOADS_DIR = os.path.join(BACKEND_DIR, "uploads")

sys.path.insert(0, BACKEND_DIR)
from utils.security import hash_password

COLLECTIONS = [
    "users",
    "departments",
    "employees",
    "assets",
    "asset_verifications",
    "trust_scores",
    "incidents",
    "recommendations",
    "audit_logs"
]

ADMIN_EMAIL = "admin@trustsphere.com"
ADMIN_NAME = "TrustSphere Admin"
ADMIN_ROLE = "ADMIN"
ADMIN_PASSWORD = "Admin@123"

def get_db():
    client = MongoClient(MONGODB_URL)
    return client, client[MONGODB_DATABASE]

def inspect_data(db):
    print("==================================================")
    print("TRUSTSPHEREDB COLLECTION DOCUMENT COUNTS")
    print("==================================================")
    counts = {}
    for col_name in COLLECTIONS:
        count = db[col_name].count_documents({})
        counts[col_name] = count
        print(f"  {col_name:<22}: {count:>5} documents")
    return counts

def run_cleanup(dry_run=True):
    client, db = get_db()
    
    print("\n==================================================")
    mode_label = "DRY RUN (No data deleted)" if dry_run else "EXECUTE (Cleaning test data & provisioning default admin)"
    print(f"CLEANUP MODE: {mode_label}")
    print("==================================================")

    before_counts = inspect_data(db)

    # Delete all test/demo records across collections
    test_queries = {
        # Delete all test accounts except the required default admin
        "users": {"email": {"$ne": ADMIN_EMAIL}},
        "departments": {},
        "employees": {},
        "assets": {},
        "asset_verifications": {},
        "trust_scores": {},
        "incidents": {},
        "recommendations": {},
        "audit_logs": {}
    }

    print("\nPlanned Deletions by Collection:")
    for col_name in COLLECTIONS:
        query = test_queries.get(col_name, {})
        to_delete = db[col_name].count_documents(query)
        retained = before_counts[col_name] - to_delete
        print(f"  {col_name:<22}: {to_delete} records will be deleted ({retained} retained)")

    if dry_run:
        print("\n[DRY RUN COMPLETE] No data was deleted from MongoDB.")
        print("To execute this cleanup, run:")
        print("    python scripts/cleanup_test_data.py --execute")
        client.close()
        return

    # Execution phase
    print("\n[EXECUTING DATA CLEANUP] Removing test documents without dropping collections...")
    for col_name in COLLECTIONS:
        query = test_queries.get(col_name, {})
        res = db[col_name].delete_many(query)
        print(f"  Deleted {res.deleted_count:>4} records from '{col_name}'.")

    # Clean uploads directory test files
    if os.path.exists(UPLOADS_DIR):
        uploaded_files = [f for f in os.listdir(UPLOADS_DIR) if f.endswith(".pdf")]
        print(f"\nCleaning {len(uploaded_files)} test PDF files from {UPLOADS_DIR}...")
        for fname in uploaded_files:
            try:
                os.remove(os.path.join(UPLOADS_DIR, fname))
            except Exception as e:
                print(f"  Warning: failed to remove {fname}: {e}")
        print("  Uploads directory sanitized.")

    # Ensure the single required default ADMIN account exists
    existing_admin = db.users.find_one({"email": ADMIN_EMAIL})
    if not existing_admin:
        now_iso = datetime.utcnow().isoformat()
        admin_doc = {
            "name": ADMIN_NAME,
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "role": ADMIN_ROLE,
            "created_at": now_iso,
            "updated_at": now_iso
        }
        db.users.insert_one(admin_doc)
        print(f"\n[PROVISIONED ADMIN] Created default administrator account:")
        print(f"  Email: {ADMIN_EMAIL}")
        print(f"  Role:  {ADMIN_ROLE}")
        print(f"  Hash:  (PBKDF2 salted hash)")
    else:
        print(f"\n[ADMIN CONFIRMED] Default admin account already exists ({ADMIN_EMAIL}).")

    print("\nFinal Database State After Cleanup:")
    after_counts = inspect_data(db)
    print("\n[CLEANUP COMPLETED] Database restored to pristine production state:")
    print("  - users: 1 default ADMIN account")
    print("  - departments: 0 records")
    print("  - employees: 0 records")
    print("  - assets: 0 records")
    print("  - asset_verifications: 0 records")
    print("  - trust_scores: 0 records")
    print("  - incidents: 0 records")
    print("  - recommendations: 0 records")
    print("  - audit_logs: 0 records")
    print("  - All collection structures and indexes preserved.")
    client.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TrustSphereDB Test & Demo Data Cleanup Script")
    parser.add_argument("--execute", action="store_true", help="Execute actual deletion (default is dry-run)")
    args = parser.parse_args()

    run_cleanup(dry_run=not args.execute)
