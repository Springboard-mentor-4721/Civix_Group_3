"""
Dev utility: Reset face_verified for a user so they can redo face capture.
Usage: python reset_face_verification.py <email>
"""
import sys
sys.path.insert(0, '.')

from app.database import engine
from sqlalchemy import text

if len(sys.argv) < 2:
    print("Usage: python reset_face_verification.py <email>")
    sys.exit(1)

email = sys.argv[1].strip().lower()

with engine.connect() as conn:
    result = conn.execute(
        text("SELECT id, name, email, face_verified, is_email_verified FROM users WHERE email = :email"),
        {"email": email}
    )
    row = result.fetchone()
    if not row:
        print(f"[ERROR] No user found with email: {email}")
        sys.exit(1)

    print(f"Found user: id={row[0]}, name={row[1]}, email={row[2]}")
    print(f"  face_verified={row[3]}, is_email_verified={row[4]}")

    conn.execute(
        text("UPDATE users SET face_verified=0, face_verified_at=NULL, profile_picture_url=NULL, profile_picture_public_id=NULL WHERE email=:email"),
        {"email": email}
    )
    conn.commit()
    print(f"[SUCCESS] face_verified reset for {email}. User can now redo face capture.")
