from __future__ import annotations
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, field_validator
from app.schemas.petition import PetitionCategory


class PollStatusEnum(str, Enum):
    draft = "draft"
    scheduled = "scheduled"
    active = "active"
    closed = "closed"


class PollOptionCreate(BaseModel):
    option_text: str = Field(..., min_length=1, max_length=255)
    display_order: Optional[int] = 0


class PollOptionResponse(BaseModel):
    id: int
    poll_id: int
    option_text: str
    display_order: int

    model_config = ConfigDict(from_attributes=True)


class PollCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    question: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    category: PetitionCategory
    location: str = Field(..., min_length=1, max_length=100)
    petition_id: int = Field(..., gt=0, description="ID of the existing petition this poll is created for")
    start_at: datetime
    end_at: datetime
    options: List[PollOptionCreate] = Field(..., min_length=2)

    @field_validator("options")
    @classmethod
    def validate_options(cls, v: List[PollOptionCreate]) -> List[PollOptionCreate]:
        if len(v) < 2:
            raise ValueError("A poll must have at least 2 options")
        seen = set()
        for opt in v:
            txt = opt.option_text.strip().lower()
            if not txt:
                raise ValueError("Option text cannot be empty")
            if txt in seen:
                raise ValueError("Duplicate options are not allowed")
            seen.add(txt)
        return v

    @field_validator("end_at")
    @classmethod
    def validate_end_at(cls, v: datetime, info) -> datetime:
        start_at = info.data.get("start_at")
        if start_at:
            v_naive = v.astimezone(timezone.utc).replace(tzinfo=None) if v.tzinfo else v
            s_naive = start_at.astimezone(timezone.utc).replace(tzinfo=None) if start_at.tzinfo else start_at
            if v_naive <= s_naive:
                raise ValueError("End time must be strictly after start time")
        return v


class PollUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    question: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    category: Optional[PetitionCategory] = None
    location: Optional[str] = Field(None, min_length=1, max_length=100)
    petition_id: Optional[int] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    options: Optional[List[PollOptionCreate]] = None

    @field_validator("options")
    @classmethod
    def validate_options(cls, v: Optional[List[PollOptionCreate]]) -> Optional[List[PollOptionCreate]]:
        if v is not None:
            if len(v) < 2:
                raise ValueError("A poll must have at least 2 options")
            seen = set()
            for opt in v:
                txt = opt.option_text.strip().lower()
                if not txt:
                    raise ValueError("Option text cannot be empty")
                if txt in seen:
                    raise ValueError("Duplicate options are not allowed")
                seen.add(txt)
        return v


class PollStatusPatch(BaseModel):
    status: PollStatusEnum


class VoteCreate(BaseModel):
    option_id: int


class PollResponse(BaseModel):
    id: int
    title: str
    question: str
    description: Optional[str] = None
    category: PetitionCategory
    location: str
    petition_id: Optional[int] = None
    petition_title: Optional[str] = None
    start_at: datetime
    end_at: datetime
    status: PollStatusEnum
    created_by: int
    creator_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    options: List[PollOptionResponse] = []
    total_votes: int = 0
    has_voted: bool = False
    voted_option_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class PollListResponse(BaseModel):
    polls: List[PollResponse]
    total: int
    page: int
    per_page: int


class PollOptionResult(BaseModel):
    id: int
    text: str
    votes: int
    percentage: float


class VotingActivityPoint(BaseModel):
    date: str
    votes: int


class PollResultsResponse(BaseModel):
    poll_id: int
    title: str
    question: str
    description: Optional[str] = None
    category: PetitionCategory
    location: str
    petition_id: Optional[int] = None
    petition_title: Optional[str] = None
    status: PollStatusEnum
    start_at: datetime
    end_at: datetime
    total_votes: int
    options: List[PollOptionResult]
    voting_activity: List[VotingActivityPoint] = []

