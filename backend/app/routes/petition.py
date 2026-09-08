from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.petition import Petition
from app.models.signature import Signature
from app.schemas.petition import PetitionCreate, PetitionUpdate, PetitionResponse, PetitionCategory, PetitionStatus, PetitionDetailResponse, PetitionDeleteResponse, SignatureResponse, MyPetitionsResponse, PetitionStatusUpdate
from app.routes.auth import get_current_user
from app.models.user import User
from fastapi import APIRouter, Depends, status, HTTPException


router = APIRouter(
    prefix="/api/petitions",
    tags=["Petitions"]
)


@router.post(
    "",
    response_model=PetitionResponse,
    status_code=status.HTTP_201_CREATED
)


def create_petition(
    payload: PetitionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    petition = Petition(
        creator_id=current_user.id,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        location=payload.location,
        signature_goal=payload.signature_goal,
        status="active"
    )

    db.add(petition)
    db.commit()
    db.refresh(petition)

    return {
        "id": petition.id,
        "title": petition.title,
        "description": petition.description,
        "category": petition.category,
        "location": petition.location,
        "status": petition.status,
        "signature_goal": petition.signature_goal,
        "signature_count": 0,
        "creator_id": petition.creator_id,
        "created_at": petition.created_at,
        "updated_at": petition.updated_at,
    }


@router.get("")
def get_petitions(
    location: str | None = None,
    category: PetitionCategory | None = None,
    status: PetitionStatus | None = None,
    page: int = 1,
    per_page: int = 10,
    db: Session = Depends(get_db),
):
    query = db.query(Petition)

    # Filters
    if location:
        query = query.filter(Petition.location == location)

    if category:
        query = query.filter(Petition.category == category)

    if status:
        query = query.filter(Petition.status == status)

    # Total number of matching petitions
    total = query.count()

    # Pagination
    offset = (page - 1) * per_page

    petitions = (
        query
        .order_by(Petition.created_at.desc())
        .offset(offset)
        .limit(per_page)
        .all()
    )

    result = []

    for petition in petitions:
        result.append({
            "id": petition.id,
            "title": petition.title,
            "description": petition.description,
            "category": petition.category,
            "location": petition.location,
            "status": petition.status,
            "signature_goal": petition.signature_goal,
            "signature_count": 0,
            "creator_id": petition.creator_id,
            "created_at": petition.created_at,
            "updated_at": petition.updated_at,
        })

    return {
        "petitions": result,
        "total": total,
        "page": page,
        "per_page": per_page,
    }

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

    result = []

    for petition in petitions:
        signature_count = (
            db.query(Signature)
            .filter(Signature.petition_id == petition.id)
            .count()
        )

        result.append({
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
        })

    return {
        "petitions": result,
        "total": len(result),
        "active_count": sum(
            1 for p in petitions
            if p.status == PetitionStatus.active
        ),
        "closed_count": sum(
            1 for p in petitions
            if p.status == PetitionStatus.closed
        ),
    }

@router.get("/signed")
def get_signed_petitions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    results = (
        db.query(Petition, Signature.timestamp)
        .join(
            Signature,
            Signature.petition_id == Petition.id
        )
        .filter(
            Signature.user_id == current_user.id
        )
        .order_by(Signature.timestamp.desc())
        .all()
    )

    petitions = []

    for petition, signed_at in results:
        signature_count = (
            db.query(Signature)
            .filter(Signature.petition_id == petition.id)
            .count()
        )

        petitions.append({
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
            "signed_at": signed_at,
        })

    return {
        "petitions": petitions,
        "total": len(petitions)
    }

@router.patch("/{petition_id}/status", response_model=PetitionResponse)
def update_petition_status(
    petition_id: int,
    payload: PetitionStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "official":
        raise HTTPException(
            status_code=403,
            detail="Officials only"
        )

    petition = (
        db.query(Petition)
        .filter(Petition.id == petition_id)
        .first()
    )

    if not petition:
        raise HTTPException(
            status_code=404,
            detail="Petition not found"
        )

    petition.status = payload.status

    db.commit()
    db.refresh(petition)

    signature_count = (
        db.query(Signature)
        .filter(Signature.petition_id == petition.id)
        .count()
    )

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


@router.get("/{petition_id}", response_model=PetitionDetailResponse)
def get_petition(
    petition_id: int,
    db: Session = Depends(get_db),
):
    petition = (
        db.query(Petition)
        .filter(Petition.id == petition_id)
        .first()
    )

    if not petition:
        raise HTTPException(
            status_code=404,
            detail="Petition not found"
        )

    signature_count = (
        db.query(Signature)
        .filter(Signature.petition_id == petition.id)
        .count()
    )

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
        "has_signed": False,
    }


@router.put("/{petition_id}", response_model=PetitionResponse)
def update_petition(
    petition_id: int,
    payload: PetitionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    petition = (
        db.query(Petition)
        .filter(Petition.id == petition_id)
        .first()
    )

    if not petition:
        raise HTTPException(
            status_code=404,
            detail="Petition not found"
        )

    # Only the creator can edit
    if petition.creator_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only edit your own petition"
        )

    # Closed petitions cannot be edited
    if petition.status == PetitionStatus.closed:
        raise HTTPException(
            status_code=400,
            detail="Closed petitions cannot be edited"
        )

    # Update only the fields provided by the user
    update_data = payload.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(petition, field, value)

    db.commit()
    db.refresh(petition)

    signature_count = (
        db.query(Signature)
        .filter(Signature.petition_id == petition.id)
        .count()
    )

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


@router.delete("/{petition_id}", response_model=PetitionDeleteResponse)
def delete_petition(
    petition_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    petition = (
        db.query(Petition)
        .filter(Petition.id == petition_id)
        .first()
    )

    if not petition:
        raise HTTPException(
            status_code=404,
            detail="Petition not found"
        )

    # Only the creator can delete
    if petition.creator_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only delete your own petition"
        )

    # Delete signatures first
    db.query(Signature).filter(
        Signature.petition_id == petition.id
    ).delete(synchronize_session=False)

    # Delete petition
    db.delete(petition)
    db.commit()

    return {
        "message": "Petition deleted successfully"
    }


@router.post("/{petition_id}/sign", response_model=SignatureResponse, status_code=status.HTTP_201_CREATED)
def sign_petition(
    petition_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    petition = (
        db.query(Petition)
        .filter(Petition.id == petition_id)
        .first()
    )

    if not petition:
        raise HTTPException(
            status_code=404,
            detail="Petition not found"
        )

    # Only active petitions can be signed
    if petition.status != PetitionStatus.active:
        raise HTTPException(
            status_code=400,
            detail="Only active petitions can be signed"
        )

    # Creator cannot sign their own petition
    if petition.creator_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot sign your own petition"
        )

    # Check for duplicate signature
    existing_signature = (
        db.query(Signature)
        .filter(
            Signature.petition_id == petition_id,
            Signature.user_id == current_user.id
        )
        .first()
    )

    if existing_signature:
        raise HTTPException(
            status_code=409,
            detail="You have already signed this petition"
        )

    # Create signature
    signature = Signature(
        petition_id=petition_id,
        user_id=current_user.id
    )

    db.add(signature)
    db.commit()

    # Recalculate signature count
    signature_count = (
        db.query(Signature)
        .filter(Signature.petition_id == petition_id)
        .count()
    )

    # Move petition to under_review when goal is reached
    if signature_count >= petition.signature_goal:
        petition.status = PetitionStatus.under_review
        db.commit()

    return {
        "signature_count": signature_count,
        "has_signed": True
    }


@router.delete("/{petition_id}/sign", response_model=SignatureResponse)
def withdraw_signature(
    petition_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    petition = (
        db.query(Petition)
        .filter(Petition.id == petition_id)
        .first()
    )

    if not petition:
        raise HTTPException(
            status_code=404,
            detail="Petition not found"
        )

    signature = (
        db.query(Signature)
        .filter(
            Signature.petition_id == petition_id,
            Signature.user_id == current_user.id
        )
        .first()
    )

    if not signature:
        raise HTTPException(
            status_code=404,
            detail="You have not signed this petition"
        )

    db.delete(signature)
    db.commit()

    signature_count = (
        db.query(Signature)
        .filter(Signature.petition_id == petition_id)
        .count()
    )

    if (
        petition.status == PetitionStatus.under_review
        and signature_count < petition.signature_goal
    ):
        petition.status = PetitionStatus.active
        db.commit()

    return {
        "signature_count": signature_count,
        "has_signed": False
    }
