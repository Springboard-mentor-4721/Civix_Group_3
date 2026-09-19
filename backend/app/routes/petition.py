from fastapi import APIRouter, Depends, HTTPException, status as http_status
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models.petition import Petition, PetitionPhoto
from app.models.signature import Signature
from app.models.official_response import OfficialResponse
from app.schemas.petition import (
    PetitionCreate, PetitionUpdate, PetitionResponse,
    PetitionCategory, PetitionStatus, PetitionDetailResponse,
    PetitionDeleteResponse, SignatureResponse,
    MyPetitionsResponse, PetitionStatusUpdate,
    DashboardStats, OfficialResponseCreate, OfficialResponseOut,
)
from app.routes.auth import get_current_user, require_official
from app.models.user import User, UserRole
from app.utils.cloudinary_utils import upload_base64_image
from app.utils.email import send_petition_notification_email
import threading

router = APIRouter(prefix="/api/petitions", tags=["Petitions"])


def _build_petition_dict(petition: Petition, signature_count: int, photos_list=None) -> dict:
    if photos_list is not None:
        photos_data = photos_list
    else:
        try:
            photos_data = [{"id": p.id, "url": p.url} for p in (petition.photos or [])]
        except Exception:
            photos_data = []

    creator_name = None
    creator_profile_pic = None
    try:
        if petition.creator:
            creator_name = petition.creator.name
            creator_profile_pic = petition.creator.profile_picture_url
    except Exception:
        pass

    return {
        "id": petition.id,
        "title": petition.title,
        "description": petition.description,
        "category": petition.category,
        "location": petition.location,
        "status": petition.status,
        "signature_goal": petition.signature_goal,
        "signature_count": signature_count,
        "creator_id": petition.creator_id,
        "creator_name": creator_name,
        "creator_profile_picture_url": creator_profile_pic,
        "created_at": petition.created_at,
        "updated_at": petition.updated_at,
        "photos": photos_data,
    }


def _get_signature_count(db: Session, petition_id: int) -> int:
    return db.query(Signature).filter(Signature.petition_id == petition_id).count()


# ── Create Petition ────────────────────────────────────────────────────────────

@router.post("", response_model=PetitionResponse, status_code=http_status.HTTP_201_CREATED)
def create_petition(
    payload: PetitionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validate photos count
    if not payload.photos or len(payload.photos) < 3:
        raise HTTPException(status_code=400, detail="Minimum 3 photos are required")
    if len(payload.photos) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 photos are allowed")

    petition = Petition(
        creator_id=current_user.id,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        location=payload.location,
        signature_goal=payload.signature_goal,
        status=PetitionStatus.active,
    )
    db.add(petition)
    db.commit()
    db.refresh(petition)

    # Upload photos to Cloudinary and save
    photos_out = []
    for img_data in payload.photos:
        try:
            result = upload_base64_image(img_data, folder="civix/petition_photos")
            photo = PetitionPhoto(
                petition_id=petition.id,
                url=result["url"],
                public_id=result.get("public_id"),
            )
            db.add(photo)
            db.flush()
            photos_out.append({"id": photo.id, "url": photo.url})
        except Exception as e:
            print(f"[WARN] Photo upload failed: {e}")
    db.commit()

    pet_id = petition.id
    pet_location = payload.location.strip()
    pet_title = payload.title
    pet_description = payload.description
    pet_category = payload.category.value if hasattr(payload.category, 'value') else str(payload.category)
    creator_id = current_user.id

    # Send email to all citizens in same location (in isolated background thread)
    def _notify(p_id: int, p_loc: str, p_title: str, p_desc: str, p_cat: str, c_id: int):
        bg_db = SessionLocal()
        try:
            citizens = bg_db.query(User).filter(
                (User.location == p_loc) | (User.location.ilike(f"%{p_loc}%")),
                User.role == UserRole.citizen,
                User.id != c_id,
            ).all()
            for citizen in citizens:
                try:
                    send_petition_notification_email(
                        to_email=citizen.email,
                        citizen_name=citizen.name,
                        petition_title=p_title,
                        petition_description=p_desc,
                        petition_location=p_loc,
                        petition_category=p_cat,
                        petition_id=p_id,
                    )
                except Exception as e:
                    print(f"[WARN] Email to {citizen.email} failed: {e}")
        except Exception as e:
            print(f"[WARN] Notification thread error: {e}")
        finally:
            bg_db.close()

    threading.Thread(
        target=_notify,
        args=(pet_id, pet_location, pet_title, pet_description, pet_category, creator_id),
        daemon=True
    ).start()

    return _build_petition_dict(petition, 0, photos_list=photos_out)


# ── Official Dashboard Stats ───────────────────────────────────────────────────

# ── Official Dashboard Stats ───────────────────────────────────────────────────

@router.get("/official/dashboard", response_model=DashboardStats)
def official_dashboard(
    current_user: User = Depends(require_official),
    db: Session = Depends(get_db),
):
    query = db.query(Petition)
    if current_user.department:
        query = query.filter(Petition.category == current_user.department)
    if current_user.location:
        query = query.filter(Petition.location.ilike(f"%{current_user.location}%"))

    petitions = query.all()
    ids = [p.id for p in petitions]
    total_sigs = db.query(Signature).filter(Signature.petition_id.in_(ids)).count() if ids else 0

    def _count(s: PetitionStatus) -> int:
        return sum(1 for p in petitions if p.status == s)

    return DashboardStats(
        total_petitions=len(petitions),
        active=_count(PetitionStatus.active),
        under_review=_count(PetitionStatus.under_review),
        in_progress=_count(PetitionStatus.in_progress),
        resolved=_count(PetitionStatus.resolved),
        closed=_count(PetitionStatus.closed),
        total_signatures=total_sigs,
        department=current_user.department or "",
        jurisdiction=current_user.location or "",
    )


# ── Official Petition List ─────────────────────────────────────────────────────

@router.get("/official/list")
def official_petition_list(
    petition_status: PetitionStatus | None = None,
    page: int = 1,
    per_page: int = 100,
    current_user: User = Depends(require_official),
    db: Session = Depends(get_db),
):
    query = db.query(Petition)
    if current_user.department:
        query = query.filter(Petition.category == current_user.department)
    if current_user.location:
        query = query.filter(Petition.location.ilike(f"%{current_user.location}%"))
    if petition_status:
        query = query.filter(Petition.status == petition_status)

    total = query.count()
    petitions = (
        query.order_by(Petition.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return {
        "petitions": [_build_petition_dict(p, _get_signature_count(db, p.id)) for p in petitions],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


# ── List Petitions (auth required) ────────────────────────────────────────────

@router.get("", response_model=None)
def get_petitions(
    location: str | None = None,
    category: PetitionCategory | None = None,
    petition_status: PetitionStatus | None = None,
    page: int = 1,
    per_page: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Petition)

    # Officials can ONLY see petitions in their assigned department
    if current_user.role == UserRole.official and current_user.department:
        query = query.filter(Petition.category == current_user.department)

    if location:
        query = query.filter(Petition.location == location)
    if category:
        query = query.filter(Petition.category == category)
    if petition_status:
        query = query.filter(Petition.status == petition_status)

    total = query.count()
    petitions = (
        query
        .order_by(Petition.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return {
        "petitions": [_build_petition_dict(p, _get_signature_count(db, p.id)) for p in petitions],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


# ── My Petitions ───────────────────────────────────────────────────────────────

@router.get("/mine", response_model=MyPetitionsResponse)
def get_my_petitions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    petitions = (
        db.query(Petition)
        .filter(Petition.creator_id == current_user.id)
        .order_by(Petition.created_at.desc())
        .all()
    )

    result = [_build_petition_dict(p, _get_signature_count(db, p.id)) for p in petitions]

    return {
        "petitions": result,
        "total": len(result),
        "active_count": sum(1 for p in petitions if p.status == PetitionStatus.active),
        "closed_count": sum(1 for p in petitions if p.status == PetitionStatus.closed),
    }


# ── Signed Petitions ───────────────────────────────────────────────────────────

@router.get("/signed")
def get_signed_petitions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    results = (
        db.query(Petition, Signature.timestamp)
        .join(Signature, Signature.petition_id == Petition.id)
        .filter(Signature.user_id == current_user.id)
        .order_by(Signature.timestamp.desc())
        .all()
    )

    petitions = []
    for petition, signed_at in results:
        data = _build_petition_dict(petition, _get_signature_count(db, petition.id))
        data["signed_at"] = signed_at
        petitions.append(data)

    return {"petitions": petitions, "total": len(petitions)}


# ── Get Single Petition (auth required) ───────────────────────────────────────

@router.get("/{petition_id}", response_model=PetitionDetailResponse)
def get_petition(
    petition_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    petition = db.query(Petition).filter(Petition.id == petition_id).first()
    if not petition:
        raise HTTPException(status_code=404, detail="Petition not found")

    if current_user.role == UserRole.official and current_user.department:
        if petition.category != current_user.department:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. As an Official of the '{current_user.department}' department, you can only view petitions related to your department."
            )

    signature_count = _get_signature_count(db, petition_id)
    has_signed = db.query(Signature).filter(
        Signature.petition_id == petition_id,
        Signature.user_id == current_user.id,
    ).first() is not None

    responses = (
        db.query(OfficialResponse)
        .filter(OfficialResponse.petition_id == petition_id)
        .order_by(OfficialResponse.created_at.desc())
        .all()
    )
    resp_list = [
        {
            "id": r.id,
            "petition_id": r.petition_id,
            "official_id": r.official_id,
            "response_text": r.response_text,
            "action_taken": r.action_taken,
            "created_at": r.created_at,
        }
        for r in responses
    ]

    data = _build_petition_dict(petition, signature_count)
    data["has_signed"] = has_signed
    data["official_responses"] = resp_list
    return data


# ── Update Petition ────────────────────────────────────────────────────────────

@router.put("/{petition_id}", response_model=PetitionResponse)
def update_petition(
    petition_id: int,
    payload: PetitionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    raise HTTPException(
        status_code=403,
        detail="Editing submitted petitions is disabled to preserve civic integrity once published."
    )


# ── Update Petition Status (Officials only) ────────────────────────────────────

@router.patch("/{petition_id}/status", response_model=PetitionResponse)
def update_petition_status(
    petition_id: int,
    payload: PetitionStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "official":
        raise HTTPException(status_code=403, detail="Only officials can update petition status")

    petition = db.query(Petition).filter(Petition.id == petition_id).first()
    if not petition:
        raise HTTPException(status_code=404, detail="Petition not found")

    petition.status = payload.status
    db.commit()
    db.refresh(petition)
    return _build_petition_dict(petition, _get_signature_count(db, petition_id))


# ── Delete Petition ────────────────────────────────────────────────────────────

@router.delete("/{petition_id}", response_model=PetitionDeleteResponse)
def delete_petition(
    petition_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    raise HTTPException(
        status_code=403,
        detail="Deleting published petitions is disabled to preserve civic record integrity."
    )


# ── Sign Petition ──────────────────────────────────────────────────────────────

@router.post("/{petition_id}/sign", response_model=SignatureResponse, status_code=http_status.HTTP_201_CREATED)
def sign_petition(
    petition_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    petition = db.query(Petition).filter(Petition.id == petition_id).first()
    if not petition:
        raise HTTPException(status_code=404, detail="Petition not found")
    if petition.status != PetitionStatus.active:
        raise HTTPException(status_code=400, detail="Only active petitions can be signed")
    if petition.creator_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot sign your own petition")

    already_signed = db.query(Signature).filter(
        Signature.petition_id == petition_id,
        Signature.user_id == current_user.id,
    ).first()
    if already_signed:
        raise HTTPException(status_code=409, detail="You have already signed this petition")

    db.add(Signature(petition_id=petition_id, user_id=current_user.id))
    db.commit()

    signature_count = _get_signature_count(db, petition_id)

    if signature_count >= petition.signature_goal:
        petition.status = PetitionStatus.under_review
        db.commit()

    return {"signature_count": signature_count, "has_signed": True}


# ── Add Official Response ──────────────────────────────────────────────────────

@router.post("/{petition_id}/respond", response_model=OfficialResponseOut, status_code=http_status.HTTP_201_CREATED)
def add_official_response(
    petition_id: int,
    payload: OfficialResponseCreate,
    current_user: User = Depends(require_official),
    db: Session = Depends(get_db),
):
    petition = db.query(Petition).filter(Petition.id == petition_id).first()
    if not petition:
        raise HTTPException(status_code=404, detail="Petition not found")

    resp = OfficialResponse(
        petition_id=petition_id,
        official_id=current_user.id,
        response_text=payload.response_text,
        action_taken=payload.action_taken,
    )
    db.add(resp)
    db.commit()
    db.refresh(resp)
    return resp
