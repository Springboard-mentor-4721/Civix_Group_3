import sys
sys.path.insert(0, '.')

from app.database import engine
from sqlalchemy import text, inspect

def run():
    inspector = inspect(engine)

    # ── users table ──────────────────────────────────────────────────────────
    existing = [c['name'] for c in inspector.get_columns('users')]
    print("Existing users columns:", existing, flush=True)

    new_columns = [
        ("is_email_verified",            "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("organization",                 "VARCHAR(150)"),
        ("department",                   "VARCHAR(150)"),
        ("designation",                  "VARCHAR(100)"),
        ("official_id",                  "VARCHAR(100)"),
        ("jurisdiction",                 "VARCHAR(100)"),
        ("phone",                        "VARCHAR(20)"),
        ("verification_submitted_at",    "DATETIME"),
        ("verification_reviewed_at",     "DATETIME"),
        ("verification_reviewed_by",     "INT"),
        ("verification_rejection_reason","TEXT"),
        ("profile_picture_url",          "VARCHAR(500)"),
        ("must_change_password",         "TINYINT(1) NOT NULL DEFAULT 0"),
        ("department_id",                "VARCHAR(50)"),
    ]

    with engine.connect() as conn:
        for col, typedef in new_columns:
            if col not in existing:
                sql = f"ALTER TABLE users ADD COLUMN {col} {typedef}"
                conn.execute(text(sql))
                print(f"  Added: {col}", flush=True)
            else:
                print(f"  Skip (exists): {col}", flush=True)

        # Extend the enum to include under_review
        conn.execute(text(
            "ALTER TABLE users MODIFY COLUMN verification_status "
            "ENUM('not_required','pending','under_review','verified','rejected') "
            "NOT NULL DEFAULT 'pending'"
        ))
        print("  Modified: verification_status enum", flush=True)

        # Copy is_verified -> is_email_verified for existing rows
        conn.execute(text(
            "UPDATE users SET is_email_verified = is_verified WHERE is_email_verified = FALSE"
        ))
        print("  Backfilled: is_email_verified from is_verified", flush=True)

        # Fix legacy is_verified column — give it a default so new INSERTs don't fail
        conn.execute(text('ALTER TABLE users MODIFY COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0'))
        print('  Fixed: is_verified default', flush=True)

        conn.commit()

    # ── petitions enum extension ─────────────────────────────────────────────
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE petitions MODIFY COLUMN status "
            "ENUM('active','under_review','in_progress','resolved','closed') "
            "NOT NULL DEFAULT 'active'"
        ))
        print("  Modified: petitions.status enum", flush=True)
        conn.commit()

    # ── new tables ────────────────────────────────────────────────────────────
    from app.models.user import OfficialVerification, AuditLog
    from app.models.petition import PetitionOfficialResponse
    from app.database import Base

    Base.metadata.create_all(bind=engine, tables=[
        OfficialVerification.__table__,
        AuditLog.__table__,
        PetitionOfficialResponse.__table__,
    ])
    print("New tables created (if not exist)", flush=True)
    print("Migration complete.", flush=True)

if __name__ == "__main__":
    run()
