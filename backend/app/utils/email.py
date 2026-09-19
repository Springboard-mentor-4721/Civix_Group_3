import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST     = os.getenv("SMTP_HOST")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
FROM_EMAIL    = os.getenv("SMTP_FROM_EMAIL", "noreply@civix.org")
FROM_NAME     = os.getenv("SMTP_FROM_NAME", "Civix")
FRONTEND_URL  = os.getenv("FRONTEND_URL", "http://localhost:4200")


def _get_image_path(filename: str) -> str | None:
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "..", "static", filename),
        os.path.join(os.path.dirname(__file__), "..", "..", "static", filename),
        os.path.join(os.path.dirname(__file__), "..", "..", "app", "static", filename),
    ]
    for path in possible_paths:
        if os.path.exists(path):
            return os.path.abspath(path)
    return None


def _html_wrapper(content: str) -> str:
    top_img_html = '<div class="top-img" style="line-height:0;"><img src="cid:civix_top_img" alt="CIVIX Header Banner" style="width:100%; max-width:600px; display:block; border:0; margin:0 auto;" /></div>'
    bottom_img_html = '<div class="bottom-img" style="line-height:0;"><img src="cid:civix_below_img" alt="CIVIX Footer Banner" style="width:100%; max-width:600px; display:block; border:0; margin:0 auto;" /></div>'

    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body {{
    margin: 0;
    padding: 0;
    background-color: #f1f5f9;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }}
  .wrap {{
    max-width: 600px;
    margin: 24px auto;
    background: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
    border: 1px solid #cbd5e1;
  }}
  .top-img img {{
    width: 100%;
    max-width: 600px;
    display: block;
    margin: 0 auto;
  }}
  .body {{
    padding: 28px 32px;
    text-align: left;
  }}
  h2 {{
    color: #0f172a;
    font-size: 20px;
    margin: 0 0 14px 0;
    font-weight: 800;
    letter-spacing: -0.02em;
  }}
  p {{
    color: #334155;
    font-size: 14px;
    line-height: 1.6;
    margin: 0 0 16px 0;
  }}
  .btn {{
    display: inline-block;
    background-color: #1e3a8a;
    color: #ffffff !important;
    text-decoration: none;
    padding: 12px 28px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 700;
    margin: 18px 0 16px 0;
    border: 1px solid #1e3a8a;
    letter-spacing: 0.3px;
    box-shadow: 0 3px 8px rgba(30, 58, 138, 0.2);
  }}
  table {{
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin: 20px 0;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    overflow: hidden;
  }}
  th, td {{
    padding: 12px 16px;
    font-size: 13px;
    border-bottom: 1px solid #e2e8f0;
    text-align: left;
  }}
  th {{
    background: #f1f5f9;
    color: #334155;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-bottom: 1px solid #cbd5e1;
  }}
  td {{
    color: #0f172a;
    font-weight: 600;
  }}
  .note {{
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 3px solid #1e3a8a;
    border-radius: 0 6px 6px 0;
    padding: 12px 16px;
    font-size: 12.5px;
    color: #475569;
    line-height: 1.5;
    margin-top: 20px;
  }}
  .footer {{
    padding: 16px 32px;
    font-size: 13.5px;
    color: #475569;
    border-top: 1px solid #e2e8f0;
    line-height: 1.5;
  }}
  .bottom-img img {{
    width: 100%;
    max-width: 600px;
    display: block;
    margin: 0 auto;
  }}
</style></head>
<body>
<div class="wrap">
  {top_img_html}
  <div class="body">{content}</div>
  <div class="footer">Regards,<br><strong style="color: #1e3a8a;">Team CIVIX</strong></div>
  {bottom_img_html}
</div>
</body></html>"""


def _send_html(to_email: str, subject: str, html: str) -> None:
    if not SMTP_HOST or not SMTP_USERNAME:
        print(f"\n[EMAIL DEV SIMULATION]\nTo: {to_email}\nSubject: {subject}\n[HTML email — check browser]\n")
        return
    try:
        msg = MIMEMultipart("related")
        msg["From"]    = f"{FROM_NAME} <{FROM_EMAIL}>"
        msg["To"]      = to_email
        msg["Subject"] = subject

        msg_alternative = MIMEMultipart("alternative")
        msg.attach(msg_alternative)

        html_part = MIMEText(html, "html")
        msg_alternative.attach(html_part)

        # Attach CID images strictly as inline MIME parts
        for cid_name, filename in [("civix_top_img", "CIVIX_TOP.png"), ("civix_below_img", "CIVIX_BELOW.png")]:
            img_path = _get_image_path(filename)
            if img_path:
                try:
                    with open(img_path, "rb") as f:
                        img = MIMEImage(f.read())
                        img.add_header("Content-ID", f"<{cid_name}>")
                        img.add_header("Content-Disposition", "inline", filename=filename)
                        msg.attach(img)
                except Exception as ex:
                    print(f"[WARN] Could not attach CID image {filename}: {ex}")

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())
    except Exception as e:
        print(f"⚠️ SMTP error ({e}). Falling back to console simulation.")


def send_verification_email(to_email: str, token: str) -> None:
    link = f"{FRONTEND_URL}/verify-email?token={token}"
    html = _html_wrapper(f"""
<h2>Verify Your Email Address</h2>
<p>Welcome to <strong>CIVIX</strong>! Please confirm your registered email address to complete your account setup and unlock full portal access.</p>
<br>
<a href="{link}" class="btn">Verify Email Address</a>
<div class="note">This verification link is secure and will expire in 30 minutes. If you did not create a CIVIX account, you can safely ignore this email.</div>
""")
    _send_html(to_email, "Civix — Verify Your Email", html)


def send_official_credentials_email(
    to_email: str,
    name: str,
    temp_password: str,
    department: str,
    department_id: str,
) -> None:
    login_link = f"{FRONTEND_URL}/login"
    html = _html_wrapper(f"""
<h2>Welcome to CIVIX, {name}!</h2>
<p>Your official account has been approved and created successfully. Below are your official portal credentials:</p>
<table>
  <tr><th>Information</th><th>Details</th></tr>
  <tr><td>Registered Email ID</td><td>{to_email}</td></tr>
  <tr><td>Temporary Password</td><td>{temp_password}</td></tr>
  <tr><td>Department ID</td><td>{department_id}</td></tr>
  <tr><td>Department Name</td><td>{department}</td></tr>
</table>
<a href="{login_link}" class="btn">Log In to CIVIX</a>
<div class="note">IMPORTANT: Upon your first login with these temporary credentials, you will be required to complete a secure password update before accessing your dashboard.</div>
""")
    _send_html(to_email, "Civix — Your Official Account Credentials", html)


def send_password_change_email(to_email: str, token: str) -> None:
    link = f"{FRONTEND_URL}/change-password?token={token}"
    html = _html_wrapper(f"""
<h2>Password Change Request</h2>
<p>A secure password-change link has been generated for your CIVIX account.</p>
<p>This link is single-use and will expire in <strong>30 minutes</strong>.</p>
<a href="{link}" class="btn">Change Password</a>
<div class="note">For security reasons, do not share this link with anyone. If you did not request this change, please contact CIVIX support immediately.</div>
""")
    _send_html(to_email, "Civix — Change Your Password", html)


def send_petition_notification_email(
    to_email: str,
    citizen_name: str,
    petition_title: str,
    petition_description: str,
    petition_location: str,
    petition_category: str,
    petition_id: int,
) -> None:
    link = f"{FRONTEND_URL}/citizen/dashboard"
    html = _html_wrapper(f"""
<h2>New Petition in Your Area</h2>
<p>Hello <strong>{citizen_name}</strong>,</p>
<p>A new civic petition has been published in <strong>{petition_location}</strong> that may interest you:</p>
<table>
  <tr><th>Field</th><th>Details</th></tr>
  <tr><td>Petition Title</td><td>{petition_title}</td></tr>
  <tr><td>Category</td><td>{petition_category}</td></tr>
  <tr><td>Location</td><td>{petition_location}</td></tr>
  <tr><td>Description</td><td>{petition_description[:200]}{'...' if len(petition_description) > 200 else ''}</td></tr>
</table>
<a href="{link}" class="btn">View &amp; Sign Petition</a>
<div class="note">Your voice matters. Participate and support community-driven civic changes in your city.</div>
""")
    _send_html(to_email, f"Civix — New Petition in {petition_location}: {petition_title[:50]}", html)