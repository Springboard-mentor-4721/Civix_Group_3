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
    closed = "closed"


class PetitionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1)
    category: PetitionCategory
    location: str = Field(..., min_length=1, max_length=100)
    signature_goal: int = Field(..., gt=0)


class PetitionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=1)
    category: Optional[PetitionCategory] = None
    location: Optional[str] = Field(None, min_length=1, max_length=100)
    signature_goal: Optional[int] = Field(None, gt=0)


class PetitionStatusUpdate(BaseModel):
    status: PetitionStatus


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
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PetitionDetailResponse(PetitionResponse):
    has_signed: bool = False


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