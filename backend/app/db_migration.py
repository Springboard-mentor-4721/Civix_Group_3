from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

def sync_schema_columns(engine: Engine) -> None:
    """
    Inspects existing database tables and safely adds any missing columns.
    Prevents OperationalError (1054, 'Unknown column...') when models are updated
    without dropping existing database tables.
    """
    try:
        inspector = inspect(engine)
    except Exception as e:
        print(f"[WARNING] Inspector failed: {e}")
        return

    # ── 1. Check 'users' table ───────────────────────────────────────────
    if inspector.has_table("users"):
        existing_cols = {col["name"] for col in inspector.get_columns("users")}
        
        user_columns_to_add = [
            ("is_email_verified", "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("email_verified_at", "DATETIME NULL"),
            ("verification_token_hash", "VARCHAR(100) NULL"),
            ("verification_token_expires_at", "DATETIME NULL"),
            ("reset_token_hash", "VARCHAR(100) NULL"),
            ("reset_token_expires_at", "DATETIME NULL"),
            ("profile_picture_url", "VARCHAR(500) NULL"),
            ("profile_picture_public_id", "VARCHAR(255) NULL"),
            ("face_verified", "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("face_verified_at", "DATETIME NULL"),
            ("must_change_password", "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("department_id", "VARCHAR(50) NULL"),
            ("verification_status", "VARCHAR(50) NOT NULL DEFAULT 'pending'"),
            ("verification_submitted_at", "DATETIME NULL"),
            ("verification_reviewed_at", "DATETIME NULL"),
            ("verification_reviewed_by", "INT NULL"),
            ("verification_rejection_reason", "TEXT NULL"),
        ]
        
        with engine.begin() as conn:
            for col_name, col_type in user_columns_to_add:
                if col_name not in existing_cols:
                    try:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                        print(f"[SUCCESS] Added missing column '{col_name}' to 'users' table.")
                    except Exception as err:
                        print(f"[WARNING] Could not add column '{col_name}' to 'users': {err}")

    # ── 2. Check 'official_verifications' table ─────────────────────────
    if inspector.has_table("official_verifications"):
        existing_cols = {col["name"] for col in inspector.get_columns("official_verifications")}
        
        ov_columns_to_add = [
            ("document_ref", "VARCHAR(500) NULL"),
            ("document_url", "VARCHAR(500) NULL"),
            ("document_public_id", "VARCHAR(255) NULL"),
            ("document_type", "VARCHAR(50) NULL"),
            ("document_size", "INT NULL"),
            ("notes", "TEXT NULL"),
            ("reviewed_at", "DATETIME NULL"),
            ("reviewed_by", "INT NULL"),
            ("status", "VARCHAR(50) NOT NULL DEFAULT 'pending'"),
            ("rejection_reason", "TEXT NULL"),
        ]
        
        with engine.begin() as conn:
            for col_name, col_type in ov_columns_to_add:
                if col_name not in existing_cols:
                    try:
                        conn.execute(text(f"ALTER TABLE official_verifications ADD COLUMN {col_name} {col_type}"))
                        print(f"[SUCCESS] Added missing column '{col_name}' to 'official_verifications' table.")
                    except Exception as err:
                        print(f"[WARNING] Could not add column '{col_name}' to 'official_verifications': {err}")
