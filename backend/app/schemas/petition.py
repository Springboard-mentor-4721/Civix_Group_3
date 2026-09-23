from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class PetitionCategory(str, Enum):
    environment = "Environment"
    infrastructure = "Infrastructure"
    education = "Education"
    public_safety = "Public Safety"
    transportation = "Transportation"
    healthcare = "Healthcare"
    housing = "Housing"


class PetitionStatus(str, Enum):
    active = "active"
    under_review = "under_review"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"


class PetitionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1)
    category: PetitionCategory
    location: str = Field(..., min_length=1, max_length=100)
    signature_goal: int = Field(..., gt=0)
    photos: list[str] = Field(..., min_length=3, max_length=5, description="List of 3-5 base64 image data URLs")


class PetitionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=1)
    category: Optional[PetitionCategory] = None
    location: Optional[str] = Field(None, min_length=1, max_length=100)
    signature_goal: Optional[int] = Field(None, gt=0)


class PetitionStatusUpdate(BaseModel):
    status: PetitionStatus


class PetitionPhotoOut(BaseModel):
    id: int
    url: str
    model_config = ConfigDict(from_attributes=True)


class OfficialResponseCreate(BaseModel):
    response_text: str = Field(..., min_length=1)
    action_taken: Optional[str] = None


class OfficialResponseOut(BaseModel):
    id: int
    petition_id: int
    official_id: int
    response_text: str
    action_taken: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PetitionResponse(BaseModel):
    id: int
    title: str
    description: str
    category: PetitionCategory
    location: str
    status: PetitionStatus
    signature_goal: int
    signature_count: int
    creator_id: int
    creator_name: Optional[str] = None
    creator_profile_picture_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    photos: list[PetitionPhotoOut] = []

    model_config = ConfigDict(from_attributes=True)


class LinkedPollOut(BaseModel):
    id: int
    title: str
    question: str
    category: str
    location: str
    status: str
    total_votes: int = 0
    has_voted: bool = False
    voted_option_id: Optional[int] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PetitionDetailResponse(PetitionResponse):
    has_signed: bool = False
    official_responses: list[OfficialResponseOut] = []
    poll: Optional[LinkedPollOut] = None


class PetitionListResponse(BaseModel):
    petitions: list[PetitionResponse]
    total: int
    page: int
    per_page: int


class SignatureResponse(BaseModel):
    signature_count: int
    has_signed: bool


class PetitionDeleteResponse(BaseModel):
    message: str


class MyPetitionsResponse(BaseModel):
    petitions: list[PetitionResponse]
    total: int
    active_count: int
    closed_count: int


class DashboardStats(BaseModel):
    total_petitions: int
    active: int
    under_review: int
    in_progress: int
    resolved: int
    closed: int
    total_signatures: int
    department: str
    jurisdiction: str