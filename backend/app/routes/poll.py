from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status as http_status, Header, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func

from app.database import get_db
from app.models.poll import Poll, PollOption, PollVote, PollStatus
from app.models.user import User, UserRole
from app.models.petition import Petition
from app.schemas.poll import (
    PollCreate, PollUpdate, PollStatusPatch, PollResponse, PollListResponse,
    PollOptionResponse, VoteCreate, PollResultsResponse, PollOptionResult,
    VotingActivityPoint, PollStatusEnum
)
from app.schemas.petition import PetitionCategory
from app.routes.auth import get_current_user, require_official, _bearer_scheme, _blacklisted_tokens
from app.utils.jwt import decode_access_token
from app.utils.email import send_poll_notification_email

router = APIRouter(prefix="/api/polls", tags=["Polls"])
_optional_bearer_scheme = HTTPBearer(auto_error=False)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _make_naive(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _resolve_effective_status(poll: Poll) -> PollStatusEnum:
    if poll.status == PollStatus.draft:
        return PollStatusEnum.draft
    if poll.status == PollStatus.closed:
        return PollStatusEnum.closed

    now = _utcnow()
    start_at = _make_naive(poll.start_at)
    end_at = _make_naive(poll.end_at)
    if start_at and start_at > now:
        return PollStatusEnum.scheduled
    elif start_at and end_at and start_at <= now <= end_at:
        return PollStatusEnum.active
    else:
        return PollStatusEnum.closed


def _get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer_scheme),
    db: Session = Depends(get_db)
) -> Optional[User]:
    if not credentials:
        return None
    token = credentials.credentials
    if token in _blacklisted_tokens:
        return None
    try:
        payload = decode_access_token(token)
        return db.query(User).filter(User.id == payload["user_id"]).first()
    except Exception:
        return None


def _build_poll_response(poll: Poll, current_user: Optional[User] = None, db: Session = None) -> dict:
    effective_status = _resolve_effective_status(poll)
    total_votes = len(poll.votes) if poll.votes is not None else 0

    has_voted = False
    voted_option_id = None

    if current_user:
        user_vote = None
        if poll.votes is not None:
            user_vote = next((v for v in poll.votes if v.user_id == current_user.id), None)
        elif db:
            user_vote = db.query(PollVote).filter(
                PollVote.poll_id == poll.id,
                PollVote.user_id == current_user.id
            ).first()

        if user_vote:
            has_voted = True
            voted_option_id = user_vote.option_id

    creator_name = poll.creator.name if poll.creator else None
    petition_title = poll.petition.title if poll.petition else None

    options_data = []
    if poll.options:
        sorted_opts = sorted(poll.options, key=lambda o: (o.display_order, o.id))
        options_data = [
            {
                "id": o.id,
                "poll_id": o.poll_id,
                "option_text": o.option_text,
                "display_order": o.display_order
            }
            for o in sorted_opts
        ]

    cat_val = poll.category.value if hasattr(poll.category, 'value') else str(poll.category)
    stat_val = effective_status.value if hasattr(effective_status, 'value') else str(effective_status)

    return {
        "id": poll.id,
        "title": poll.title,
        "question": poll.question,
        "description": poll.description,
        "category": cat_val,
        "location": poll.location,
        "petition_id": poll.petition_id,
        "petition_title": petition_title,
        "start_at": poll.start_at,
        "end_at": poll.end_at,
        "status": stat_val,
        "created_by": poll.created_by,
        "creator_name": creator_name,
        "created_at": poll.created_at,
        "updated_at": poll.updated_at,
        "options": options_data,
        "total_votes": total_votes,
        "has_voted": has_voted,
        "voted_option_id": voted_option_id
    }


# ── 1. GET /api/polls (List Polls) ─────────────────────────────────────────────

@router.get("", response_model=PollListResponse)
def list_polls(
    category: Optional[PetitionCategory] = None,
    location: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Poll)

    # Filter out drafts for non-creator / public
    if current_user.role == UserRole.official:
        # Officials see all non-drafts or their own drafts
        query = query.filter((Poll.status != PollStatus.draft) | (Poll.created_by == current_user.id))
    else:
        query = query.filter(Poll.status != PollStatus.draft)

    if category:
        query = query.filter(Poll.category == category)
    if location:
        query = query.filter(Poll.location.ilike(f"%{location.strip()}%"))
    if search:
        s_term = f"%{search.strip()}%"
        query = query.filter((Poll.title.ilike(s_term)) | (Poll.question.ilike(s_term)))

    all_polls = query.order_by(Poll.created_at.desc()).all()

    # Filter by resolved status if status parameter provided
    filtered = []
    for p in all_polls:
        eff_status = _resolve_effective_status(p)
        if status and status.lower() != "all":
            if eff_status.value != status.lower():
                continue
        filtered.append(p)

    total = len(filtered)
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    page_items = filtered[start_idx:end_idx]

    poll_responses = [_build_poll_response(p, current_user, db) for p in page_items]

    return {
        "polls": poll_responses,
        "total": total,
        "page": page,
        "per_page": per_page
    }


# ── 2. GET /api/polls/mine (Official My Polls) ─────────────────────────────────

@router.get("/mine", response_model=PollListResponse)
def list_my_polls(
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_official)
):
    query = db.query(Poll).filter(Poll.created_by == current_user.id).order_by(Poll.created_at.desc())
    total = query.count()
    polls = query.offset((page - 1) * per_page).limit(per_page).all()

    poll_responses = [_build_poll_response(p, current_user, db) for p in polls]

    return {
        "polls": poll_responses,
        "total": total,
        "page": page,
        "per_page": per_page
    }


# ── 3. GET /api/polls/{poll_id} (Poll Detail) ──────────────────────────────────

@router.get("/{poll_id}", response_model=PollResponse)
def get_poll_detail(
    poll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if not poll:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail={"code": "poll_not_found", "message": "Poll not found"}
        )

    # Draft access check
    eff_status = _resolve_effective_status(poll)
    if eff_status == PollStatusEnum.draft:
        if current_user.id != poll.created_by:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail={"code": "poll_not_found", "message": "Poll not found"}
            )

    return _build_poll_response(poll, current_user, db)


# ── 4. POST /api/polls (Create Poll - Official Only for Existing Petition) ─────

@router.post("", response_model=PollResponse, status_code=http_status.HTTP_201_CREATED)
def create_poll(
    payload: PollCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_official),
    db: Session = Depends(get_db)
):
    # A poll must strictly be created for an existing citizen petition
    if not payload.petition_id:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail={"code": "petition_required", "message": "A poll can only be created for an existing petition."}
        )

    linked_petition = db.query(Petition).filter(Petition.id == payload.petition_id).first()
    if not linked_petition:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail={"code": "petition_not_found", "message": "Specified petition not found. Polls can only be created for existing petitions."}
        )

    now = _utcnow()
    start_at = _make_naive(payload.start_at)
    end_at = _make_naive(payload.end_at)
    initial_status = PollStatus.active if (start_at <= now <= end_at) else (
        PollStatus.scheduled if start_at > now else PollStatus.closed
    )

    poll = Poll(
        title=payload.title.strip(),
        question=payload.question.strip(),
        description=payload.description.strip() if payload.description else None,
        category=payload.category,
        location=payload.location.strip(),
        petition_id=payload.petition_id,
        start_at=start_at,
        end_at=end_at,
        status=initial_status,
        created_by=current_user.id
    )
    db.add(poll)
    db.commit()
    db.refresh(poll)

    # Add options
    for idx, opt in enumerate(payload.options):
        option = PollOption(
            poll_id=poll.id,
            option_text=opt.option_text.strip(),
            display_order=opt.display_order or idx
        )
        db.add(option)

    db.commit()
    db.refresh(poll)

    # Trigger notification emails to petition creator & matching location citizens
    notified_emails = set()

    # 1. Petition Creator
    if linked_petition and linked_petition.creator and linked_petition.creator.email:
        author = linked_petition.creator
        notified_emails.add(author.email.lower())
        background_tasks.add_task(
            send_poll_notification_email,
            to_email=author.email,
            citizen_name=author.name or "Citizen",
            poll_title=poll.title,
            poll_question=poll.question,
            poll_location=poll.location,
            poll_category=poll.category.value if hasattr(poll.category, 'value') else str(poll.category),
            poll_id=poll.id,
            is_creator=True,
            petition_title=linked_petition.title
        )

    # 2. Local citizens in poll location
    citizens_in_location = db.query(User).filter(
        User.role == UserRole.citizen,
        User.location.ilike(f"%{poll.location.strip()}%")
    ).all()

    for c in citizens_in_location:
        if c.email and c.email.lower() not in notified_emails:
            notified_emails.add(c.email.lower())
            background_tasks.add_task(
                send_poll_notification_email,
                to_email=c.email,
                citizen_name=c.name or "Citizen",
                poll_title=poll.title,
                poll_question=poll.question,
                poll_location=poll.location,
                poll_category=poll.category.value if hasattr(poll.category, 'value') else str(poll.category),
                poll_id=poll.id,
                is_creator=False
            )

    return _build_poll_response(poll, current_user, db)


# ── 5. POST /api/polls/{poll_id}/vote (Citizen/Public Vote) ────────────────────

@router.post("/{poll_id}/vote", response_model=PollResultsResponse)
def submit_vote(
    poll_id: int,
    payload: VoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if not poll:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail={"code": "poll_not_found", "message": "Poll not found."}
        )

    # Effective status and schedule check
    eff_status = _resolve_effective_status(poll)
    now = _utcnow()
    start_at = _make_naive(poll.start_at)
    end_at = _make_naive(poll.end_at)

    if start_at and start_at > now:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail={"code": "poll_voting_not_started", "message": "Voting for this poll has not started yet."}
        )
    if (end_at and end_at < now) or eff_status == PollStatusEnum.closed:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail={"code": "poll_voting_closed", "message": "Voting for this poll is closed."}
        )
    if eff_status != PollStatusEnum.active:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail={"code": "poll_not_active", "message": "Poll is not active for voting."}
        )

    # Verify option belongs to this poll
    option = db.query(PollOption).filter(PollOption.id == payload.option_id, PollOption.poll_id == poll.id).first()
    if not option:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_poll_option", "message": "Invalid option selected for this poll."}
        )

    # Check if user already voted
    existing_vote = db.query(PollVote).filter(
        PollVote.poll_id == poll.id,
        PollVote.user_id == current_user.id
    ).first()

    if existing_vote:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail={"code": "already_voted", "message": "You have already voted in this poll."}
        )

    # Create vote with IntegrityError safety net
    try:
        vote = PollVote(
            poll_id=poll.id,
            option_id=option.id,
            user_id=current_user.id
        )
        db.add(vote)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail={"code": "already_voted", "message": "You have already voted in this poll."}
        )

    db.refresh(poll)
    return get_poll_results(poll_id=poll.id, db=db, current_user=current_user)


# ── 6. GET /api/polls/{poll_id}/results (Poll Results & Analytics) ─────────────

@router.get("/{poll_id}/results", response_model=PollResultsResponse)
def get_poll_results(
    poll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if not poll:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail={"code": "poll_not_found", "message": "Poll not found."}
        )

    total_votes = len(poll.votes) if poll.votes is not None else 0

    # Build option vote counts & percentages safely
    option_results = []
    if poll.options:
        sorted_opts = sorted(poll.options, key=lambda o: (o.display_order, o.id))
        for opt in sorted_opts:
            opt_votes = len(opt.votes) if opt.votes is not None else 0
            percentage = round((opt_votes / total_votes * 100.0), 2) if total_votes > 0 else 0.0
            option_results.append(
                PollOptionResult(
                    id=opt.id,
                    text=opt.option_text,
                    votes=opt_votes,
                    percentage=percentage
                )
            )

    # Group votes by date for activity trend
    activity_points = []
    if poll.votes:
        activity_dict = {}
        for v in poll.votes:
            date_str = v.voted_at.strftime("%Y-%m-%d") if v.voted_at else _utcnow().strftime("%Y-%m-%d")
            activity_dict[date_str] = activity_dict.get(date_str, 0) + 1

        for d_str in sorted(activity_dict.keys()):
            activity_points.append(VotingActivityPoint(date=d_str, votes=activity_dict[d_str]))

    eff_stat = _resolve_effective_status(poll)
    cat_val = poll.category.value if hasattr(poll.category, 'value') else str(poll.category)
    stat_val = eff_stat.value if hasattr(eff_stat, 'value') else str(eff_stat)

    return PollResultsResponse(
        poll_id=poll.id,
        title=poll.title,
        question=poll.question,
        description=poll.description,
        category=cat_val,
        location=poll.location,
        petition_id=poll.petition_id,
        petition_title=poll.petition.title if poll.petition else None,
        status=stat_val,
        start_at=poll.start_at,
        end_at=poll.end_at,
        total_votes=total_votes,
        options=option_results,
        voting_activity=activity_points
    )


# ── 7. PUT /api/polls/{poll_id} (Update Poll - Official Only) ──────────────────

@router.put("/{poll_id}", response_model=PollResponse)
def update_poll(
    poll_id: int,
    payload: PollUpdate,
    current_user: User = Depends(require_official),
    db: Session = Depends(get_db)
):
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if not poll:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail={"code": "poll_not_found", "message": "Poll not found."}
        )

    if poll.created_by != current_user.id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail={"code": "not_authorized", "message": "You are not authorized to edit this poll."}
        )

    total_votes = len(poll.votes) if poll.votes is not None else 0

    if payload.options is not None and total_votes > 0:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail={"code": "poll_has_votes", "message": "Cannot modify poll options once votes have been submitted."}
        )

    if payload.title is not None:
        poll.title = payload.title.strip()
    if payload.question is not None:
        poll.question = payload.question.strip()
    if payload.description is not None:
        poll.description = payload.description.strip() if payload.description else None
    if payload.category is not None:
        poll.category = payload.category
    if payload.location is not None:
        poll.location = payload.location.strip()
    if payload.petition_id is not None:
        poll.petition_id = payload.petition_id
    if payload.start_at is not None:
        poll.start_at = _make_naive(payload.start_at)
    if payload.end_at is not None:
        poll.end_at = _make_naive(payload.end_at)

    # Update options if allowed
    if payload.options is not None and total_votes == 0:
        # Clear existing options
        db.query(PollOption).filter(PollOption.poll_id == poll.id).delete()
        for idx, opt in enumerate(payload.options):
            new_opt = PollOption(
                poll_id=poll.id,
                option_text=opt.option_text.strip(),
                display_order=opt.display_order or idx
            )
            db.add(new_opt)

    db.commit()
    db.refresh(poll)
    return _build_poll_response(poll, current_user, db)


# ── 8. PATCH /api/polls/{poll_id}/status (Status Update - Official Only) ──────

@router.patch("/{poll_id}/status", response_model=PollResponse)
def update_poll_status(
    poll_id: int,
    payload: PollStatusPatch,
    current_user: User = Depends(require_official),
    db: Session = Depends(get_db)
):
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if not poll:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail={"code": "poll_not_found", "message": "Poll not found."}
        )

    if poll.created_by != current_user.id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail={"code": "not_authorized", "message": "You are not authorized to update this poll status."}
        )

    poll.status = PollStatus[payload.status.value]
    db.commit()
    db.refresh(poll)
    return _build_poll_response(poll, current_user, db)


# ── 9. DELETE /api/polls/{poll_id} (Delete Poll - Official Only) ───────────────

@router.delete("/{poll_id}")
def delete_poll(
    poll_id: int,
    current_user: User = Depends(require_official),
    db: Session = Depends(get_db)
):
    poll = db.query(Poll).filter(Poll.id == poll_id).first()
    if not poll:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail={"code": "poll_not_found", "message": "Poll not found."}
        )

    if poll.created_by != current_user.id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail={"code": "not_authorized", "message": "You are not authorized to delete this poll."}
        )

    db.delete(poll)
    db.commit()
    return {"message": "Poll deleted successfully."}

