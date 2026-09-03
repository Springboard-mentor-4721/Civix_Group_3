import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST     = os.getenv("SMTP_HOST")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
FROM_EMAIL    = os.getenv("SMTP_FROM_EMAIL")
FROM_NAME     = os.getenv("SMTP_FROM_NAME", "Civix")
FRONTEND_URL  = os.getenv("FRONTEND_URL", "http://localhost:4200")


def _send(to_email: str, subject: str, body: str) -> None:
    msg = MIMEMultipart()
    msg["From"]    = f"{FROM_NAME} <{FROM_EMAIL}>"
    msg["To"]      = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(FROM_EMAIL, to_email, msg.as_string())


def send_verification_email(to_email: str, token: str) -> None:
    link = f"{FRONTEND_URL}/verify-email?token={token}"
    _send(
        to_email,
        subject="Civix — Verify Your Email",
        body=f"Click the link below to verify your email (expires in 30 minutes):\n\n{link}",
    )


def send_password_reset_email(to_email: str, token: str) -> None:
    link = f"{FRONTEND_URL}/reset-password?token={token}"
    _send(
        to_email,
        subject="Civix — Reset Your Password",
        body=f"Click the link below to reset your password (expires in 30 minutes):\n\n{link}",
    )
