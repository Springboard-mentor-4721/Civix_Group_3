from fastapi import APIRouter, Depends, HTTPException, status as http_status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.petition import Petition
from app.models.signature import Signature
from app.schemas.petition import (
    PetitionCreate, PetitionUpdate, PetitionResponse,
    PetitionCategory, PetitionStatus, PetitionDetailResponse,
    PetitionDeleteResponse, SignatureResponse,
    MyPetitionsResponse, PetitionStatusUpdate,
)
from app.routes.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/petitions", tags=["Petitions"])


def _build_petition_dict(petition: Petition, signature_count: int) -> dict:
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
        "created_at": petition.created_at,
        "updated_at": petition.updated_at,
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
    return _build_petition_dict(petition, 0)


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

    signature_count = _get_signature_count(db, petition_id)
    has_signed = db.query(Signature).filter(
        Signature.petition_id == petition_id,
        Signature.user_id == current_user.id,
    ).first() is not None

    data = _build_petition_dict(petition, signature_count)
    data["has_signed"] = has_signed
    return data


# ── Update Petition ────────────────────────────────────────────────────────────

@router.put("/{petition_id}", response_model=PetitionResponse)
def update_petition(
    petition_id: int,
    payload: PetitionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    petition = db.query(Petition).filter(Petition.id == petition_id).first()
    if not petition:
        raise HTTPException(status_code=404, detail="Petition not found")
    if petition.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own petition")
    if petition.status == PetitionStatus.closed:
        raise HTTPException(status_code=400, detail="Closed petitions cannot be edited")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(petition, field, value)

    db.commit()
    db.refresh(petition)
    return _build_petition_dict(petition, _get_signature_count(db, petition_id))


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
    petition = db.query(Petition).filter(Petition.id == petition_id).first()
    if not petition:
        raise HTTPException(status_code=404, detail="Petition not found")
    if petition.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own petition")

    db.query(Signature).filter(Signature.petition_id == petition_id).delete(synchronize_session=False)
    db.delete(petition)
    db.commit()
    return {"message": "Petition deleted successfully"}


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


# ── Withdraw Signature ─────────────────────────────────────────────────────────

# @router.delete("/{petition_id}/sign", response_model=SignatureResponse)
# def withdraw_signature(
#     petition_id: int,
#     current_user: User = Depends(get_current_user),
#     db: Session = Depends(get_db),
# ):
#     petition = db.query(Petition).filter(Petition.id == petition_id).first()
#     if not petition:
#         raise HTTPException(status_code=404, detail="Petition not found")

#     signature = db.query(Signature).filter(
#         Signature.petition_id == petition_id,
#         Signature.user_id == current_user.id,
#     ).first()
#     if not signature:
#         raise HTTPException(status_code=404, detail="You have not signed this petition")

#     db.delete(signature)
#     db.commit()

#     signature_count = _get_signature_count(db, petition_id)

#     if petition.status == PetitionStatus.under_review and signature_count < petition.signature_goal:
#         petition.status = PetitionStatus.active
#         db.commit()

#     return {"signature_count": signature_count, "has_signed": False}
