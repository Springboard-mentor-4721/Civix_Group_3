from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Enum,
    DateTime,
    ForeignKey,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base
from app.schemas.petition import PetitionCategory, PetitionStatus


class Petition(Base):
    __tablename__ = "petitions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    creator_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)

    category = Column(
        Enum(PetitionCategory),
        nullable=False,
    )

    location = Column(String(100), nullable=False)

    signature_goal = Column(Integer, nullable=False)

    status = Column(
        Enum(PetitionStatus),
        nullable=False,
        default=PetitionStatus.active,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    creator = relationship("User")