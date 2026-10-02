import json
import os
import secrets
import string
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole, VerificationStatus, OfficialVerification, AuditLog
from app.models.petition import Petition, PetitionOfficialResponse, PetitionStatus
from app.models.signature import Signature
from app.schemas.petition import (
    PetitionResponse, PetitionDetailResponse, PetitionStatusUpdate,
    OfficialResponseCreate, OfficialResponseOut,
)
from app.routes.auth import get_current_user, _create_password_change_token
from app.utils.email import send_verification_approved_email, send_verification_rejected_email, send_official_approved_with_credentials
from app.utils.security import hash_password

from app.routes.petition import _filter_official_dept_query, _build_petition_dict

router = APIRouter(prefix="/api/official", tags=["Official Portal"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Role dependencies ──────────────────────────────────────────────────────────

def require_verified_official(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.official:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Officials only")
    v_stat = current_user.verification_status
    if v_stat and hasattr(v_stat, 'value'):
        v_stat = v_stat.value
    if v_stat in [VerificationStatus.rejected.value, "rejected"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your official account is not verified. Access denied.",
        )
    return current_user


def require_citizen(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.citizen:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Citizens only")
    return current_user

# ── Audit helper ───────────────────────────────────────────────────────────────

def _audit(db: Session, actor_id: int, action: str, target_type: str = None,
           target_id: int = None, detail: dict = None):
    db.add(AuditLog(
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        detail=json.dumps(detail) if detail else None,
    ))


def _sig_count(db: Session, petition_id: int) -> int:
    return db.query(Signature).filter(Signature.petition_id == petition_id).count()


def _build_petition(p: Petition, sig_count: int) -> dict:
    return _build_petition_dict(p, sig_count)


# ── Dashboard stats ────────────────────────────────────────────────────────────

@router.get("/dashboard")
def official_dashboard(
    official: User = Depends(require_verified_official),
    db: Session = Depends(get_db),
):
    """Real-time dashboard statistics for the official portal."""
    base = db.query(Petition)

    if official.department:
        base = _filter_official_dept_query(base, official.department)

    petitions = base.all()
    total = len(petitions)
    
    def _status_str(p):
        return p.status.value if hasattr(p.status, "value") else str(p.status)

    active       = sum(1 for p in petitions if _status_str(p) == "active")
    under_review = sum(1 for p in petitions if _status_str(p) == "under_review")
    in_progress  = sum(1 for p in petitions if _status_str(p) == "in_progress")
    resolved     = sum(1 for p in petitions if _status_str(p) == "resolved")
    closed       = sum(1 for p in petitions if _status_str(p) == "closed")

    ids = [p.id for p in petitions]
    total_signatures = (
        db.query(Signature)
        .filter(Signature.petition_id.in_(ids))
        .count() if ids else 0
    )

    return {
        "jurisdiction": official.location or "All",
        "department": official.department or "All",
        "total_petitions": total,
        "active": active,
        "under_review": under_review,
        "in_progress": in_progress,
        "resolved": resolved,
        "closed": closed,
        "total_signatures": total_signatures,
    }


# ── Official Petition Routes ───────────────────────────────────────────────────

@router.get("/petitions")
def list_petitions(
    petition_status: str | None = None,
    category: str | None = None,
    page: int = 1,
    per_page: int = 100,
    official: User = Depends(require_verified_official),
    db: Session = Depends(get_db),
):
    """List petitions filtered by official's department (category)."""
    query = db.query(Petition)

    if official.department:
        query = _filter_official_dept_query(query, official.department)

    if petition_status:
        try:
            query = query.filter(Petition.status == PetitionStatus(petition_status))
        except ValueError:
            pass
    if category:
        query = _filter_official_dept_query(query, category)

    total = query.count()
    petitions = (
        query.order_by(Petition.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return {
        "petitions": [_build_petition_dict(p, _sig_count(db, p.id)) for p in petitions],
        "total": total, "page": page, "per_page": per_page,
    }


@router.get("/petitions/{petition_id}")
def get_petition(
    petition_id: int,
    official: User = Depends(require_verified_official),
    db: Session = Depends(get_db),
):
    petition = db.query(Petition).filter(Petition.id == petition_id).first()
    if not petition:
        raise HTTPException(status_code=404, detail="Petition not found")

    responses = (
        db.query(PetitionOfficialResponse)
        .filter(PetitionOfficialResponse.petition_id == petition_id)
        .order_by(PetitionOfficialResponse.created_at.desc())
        .all()
    )
    resp_out = []
    for r in responses:
        off = db.query(User).filter(User.id == r.official_id).first()
        resp_out.append({
            "id": r.id, "petition_id": r.petition_id, "official_id": r.official_id,
            "official_name": off.name if off else "Unknown",
            "response_text": r.response_text, "action_taken": r.action_taken,
            "created_at": r.created_at, "updated_at": r.updated_at,
        })

    data = _build_petition(petition, _sig_count(db, petition_id))
    data["has_signed"] = False
    data["official_responses"] = resp_out
    return data


@router.patch("/petitions/{petition_id}/status")
def update_petition_status(
    petition_id: int,
    payload: PetitionStatusUpdate,
    official: User = Depends(require_verified_official),
    db: Session = Depends(get_db),
):
    petition = db.query(Petition).filter(Petition.id == petition_id).first()
    if not petition:
        raise HTTPException(status_code=404, detail="Petition not found")

    old_status = petition.status
    petition.status = payload.status
    _audit(db, official.id, "petition_status_updated", "petition", petition_id, {
        "old_status": old_status.value, "new_status": payload.status.value,
        "note": payload.note,
    })
    db.commit()
    db.refresh(petition)
    return _build_petition(petition, _sig_count(db, petition_id))


@router.post("/petitions/{petition_id}/response")
def add_official_response(
    petition_id: int,
    payload: OfficialResponseCreate,
    official: User = Depends(require_verified_official),
    db: Session = Depends(get_db),
):
    petition = db.query(Petition).filter(Petition.id == petition_id).first()
    if not petition:
        raise HTTPException(status_code=404, detail="Petition not found")

    resp = PetitionOfficialResponse(
        petition_id=petition_id,
        official_id=official.id,
        response_text=payload.response_text,
        action_taken=payload.action_taken,
    )
    db.add(resp)
    _audit(db, official.id, "official_response_submitted", "petition", petition_id, {
        "action_taken": payload.action_taken,
    })
    db.commit()
    db.refresh(resp)
    return {
        "id": resp.id, "petition_id": resp.petition_id, "official_id": resp.official_id,
        "official_name": official.name, "response_text": resp.response_text,
        "action_taken": resp.action_taken, "created_at": resp.created_at,
    }


# ── Official Verification Review Panel ────────────────────────────────────────

@router.get("/verifications/pending")
def get_pending_verifications(
    _: User = Depends(require_verified_official),
    db: Session = Depends(get_db),
):
    users = (
        db.query(User)
        .filter(
            User.role == UserRole.official,
            User.verification_status.in_([
                VerificationStatus.pending,
                VerificationStatus.under_review,
            ])
        )
        .all()
    )
    result = []
    for u in users:
        ov = db.query(OfficialVerification).filter(OfficialVerification.user_id == u.id).first()
        result.append({
            "id": u.id, "name": u.name, "email": u.email,
            "organization": None, "department": u.department,
            "designation": None, "official_id": u.department_id,
            "jurisdiction": u.location, "phone": None,
            "location": u.location,
            "verification_submitted_at": u.created_at,
            "verification_status": u.verification_status,
            "notes": ov.rejection_reason if ov else None,
            "document_url": ov.document_url if ov else None,
        })
    return result


@router.get("/verifications/all")
def get_all_officials(
    _: User = Depends(require_verified_official),
    db: Session = Depends(get_db),
):
    users = db.query(User).filter(User.role == UserRole.official).all()
    return [
        {
            "id": u.id, "name": u.name, "email": u.email,
            "organization": None, "department": u.department,
            "designation": None, "jurisdiction": u.location,
            "verification_status": u.verification_status,
            "is_email_verified": u.email_verified,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.patch("/verifications/{user_id}")
def review_official(
    user_id: int,
    payload: dict,
    reviewer: User = Depends(require_verified_official),
    db: Session = Depends(get_db),
):
    action = payload.get("action")  # "approve" | "reject" | "request_info"
    if action not in ("approve", "reject", "request_info"):
        raise HTTPException(status_code=400, detail="action must be 'approve', 'reject', or 'request_info'")
    if user_id == reviewer.id:
        raise HTTPException(status_code=400, detail="Cannot review yourself")

    user = db.query(User).filter(User.id == user_id, User.role == UserRole.official).first()
    if not user:
        raise HTTPException(status_code=404, detail="Official not found")

    ov = db.query(OfficialVerification).filter(OfficialVerification.user_id == user_id).first()

    if action == "approve":
        # Generate department ID: DEPT-<DEPT_ABBR>-<RANDOM>
        dept_abbr = ''.join(c for c in (user.department or 'GEN').upper() if c.isalpha())[:4]
        dept_id = f"DEPT-{dept_abbr}-{secrets.token_hex(3).upper()}"
        # Generate temp password
        alphabet = string.ascii_letters + string.digits
        temp_password = ''.join(secrets.choice(alphabet) for _ in range(12))

        user.verification_status = VerificationStatus.verified
        user.department_id = dept_id
        user.password = hash_password(temp_password)
        user.must_change_password = True
        if ov:
            ov.status = VerificationStatus.verified
            ov.reviewed_at = _utcnow()
        _audit(db, reviewer.id, "official_verification_approved", "user", user_id)
        db.commit()

        raw_token = _create_password_change_token(user, db)

        try:
            send_official_approved_with_credentials(user.email, user.name, dept_id, temp_password, token=raw_token)
        except Exception:
            pass

    elif action == "reject":
        reason = payload.get("reason", "")
        user.verification_status = VerificationStatus.rejected
        if ov:
            ov.status = VerificationStatus.rejected
            ov.reviewed_at = _utcnow()
            ov.rejection_reason = reason
        _audit(db, reviewer.id, "official_verification_rejected", "user", user_id, {"reason": reason})
        db.commit()
        try:
            send_verification_rejected_email(user.email, user.name, reason)
        except Exception:
            pass

    elif action == "request_info":
        user.verification_status = VerificationStatus.pending
        if ov:
            ov.status = VerificationStatus.pending
        _audit(db, reviewer.id, "official_verification_info_requested", "user", user_id)
        db.commit()
    db.refresh(user)
    return {
        "message": f"Official {action}d successfully",
        "verification_status": user.verification_status,
    }


# ── Audit Log ──────────────────────────────────────────────────────────────────

@router.get("/audit-logs")
def get_audit_logs(
    page: int = 1,
    per_page: int = 50,
    _: User = Depends(require_verified_official),
    db: Session = Depends(get_db),
):
    total = db.query(AuditLog).count()
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    result = []
    for log in logs:
        actor = db.query(User).filter(User.id == log.actor_id).first()
        result.append({
            "id": log.id,
            "actor_id": log.actor_id,
            "actor_name": actor.name if actor else "Unknown",
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "detail": log.detail,
            "created_at": log.created_at,
        })
    return {"logs": result, "total": total, "page": page, "per_page": per_page}


# ── Supporting Document Upload ─────────────────────────────────────────────────

from app.utils.cloudinary_utils import save_file_to_cloudinary_or_local

@router.post("/verification/upload-document")
def upload_verification_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.official:
        raise HTTPException(status_code=403, detail="Officials only")

    res = save_file_to_cloudinary_or_local(
        file,
        folder="official_documents",
        sub_dir="verification_docs"
    )

    ov = db.query(OfficialVerification).filter(OfficialVerification.user_id == current_user.id).first()
    if ov:
        ov.document_ref        = res["url"]
        ov.document_url        = res["url"]
        ov.document_public_id  = res["public_id"]
        ov.document_type       = res["type"]
        ov.document_size       = res["size"]
    else:
        ov = OfficialVerification(
            user_id=current_user.id,
            document_ref=res["url"],
            document_url=res["url"],
            document_public_id=res["public_id"],
            document_type=res["type"],
            document_size=res["size"],
            status=VerificationStatus.pending,
        )
        db.add(ov)
    db.commit()

    return {"document_url": res["url"], "filename": file.filename}


@router.post("/verification/upload-document-by-id/{user_id}")
def upload_verification_document_by_id(
    user_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id, User.role == UserRole.official).first()
    if not user:
        raise HTTPException(status_code=404, detail="Official user not found")

    res = save_file_to_cloudinary_or_local(
        file,
        folder="official_documents",
        sub_dir="verification_docs"
    )

    ov = db.query(OfficialVerification).filter(OfficialVerification.user_id == user.id).first()
    if ov:
        ov.document_ref        = res["url"]
        ov.document_url        = res["url"]
        ov.document_public_id  = res["public_id"]
        ov.document_type       = res["type"]
        ov.document_size       = res["size"]
    else:
        ov = OfficialVerification(
            user_id=user.id,
            document_ref=res["url"],
            document_url=res["url"],
            document_public_id=res["public_id"],
            document_type=res["type"],
            document_size=res["size"],
            status=VerificationStatus.pending,
        )
        db.add(ov)
    db.commit()

    return {"document_url": res["url"], "filename": file.filename}


