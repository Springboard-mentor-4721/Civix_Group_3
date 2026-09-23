"""
Run this ONCE to migrate existing users table to the new schema.
Usage: python migrate_auth.py
"""
import os
from dotenv import load_dotenv
import pymysql

load_dotenv()

conn = pymysql.connect(
    host=os.getenv("DB_HOST", "localhost"),
    port=int(os.getenv("DB_PORT", "3306")),
    user=os.getenv("DB_USER", "root"),
    password=os.getenv("DB_PASSWORD", ""),
    database=os.getenv("DB_NAME", "civix_db"),
)

ALTER_STATEMENTS = [
    "ALTER TABLE users ADD COLUMN department VARCHAR(100) NULL",
    "ALTER TABLE users ADD COLUMN department_id VARCHAR(50) NULL",
    "ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR(500) NULL",
    "ALTER TABLE users ADD COLUMN profile_picture_public_id VARCHAR(255) NULL",
    "ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN email_verification_token_hash VARCHAR(255) NULL",
    "ALTER TABLE users ADD COLUMN email_verification_token_expires_at DATETIME NULL",
    "ALTER TABLE users ADD COLUMN face_verified BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN face_verified_at DATETIME NULL",
    "ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN password_reset_token_hash VARCHAR(255) NULL",
    "ALTER TABLE users ADD COLUMN password_reset_token_expires_at DATETIME NULL",
    "ALTER TABLE users ADD COLUMN password_reset_used_at DATETIME NULL",
]

with conn.cursor() as cur:
    for stmt in ALTER_STATEMENTS:
        try:
            cur.execute(stmt)
            col = stmt.split("ADD COLUMN ")[1].split(" ")[0]
            print(f"OK  Added: {col}")
        except pymysql.err.OperationalError as e:
            if e.args[0] == 1060:  # Duplicate column
                col = stmt.split("ADD COLUMN ")[1].split(" ")[0]
                print(f"--  Already exists: {col}")
            else:
                print(f"ERR {e}")
    conn.commit()

conn.close()
print("\nMigration complete.")
