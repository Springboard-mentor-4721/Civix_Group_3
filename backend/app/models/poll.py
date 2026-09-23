import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
from app.schemas.petition import PetitionCategory


class PollStatus(str, enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    active = "active"
    closed = "closed"


class Poll(Base):
    __tablename__ = "polls"

    id          = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title       = Column(String(200), nullable=False)
    question    = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    category    = Column(Enum(PetitionCategory), nullable=False, index=True)
    location    = Column(String(100), nullable=False, index=True)
    start_at    = Column(DateTime, nullable=False)
    end_at      = Column(DateTime, nullable=False)
    status      = Column(Enum(PollStatus), nullable=False, default=PollStatus.draft, index=True)
    petition_id = Column(Integer, ForeignKey("petitions.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by  = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at  = Column(DateTime, nullable=False, server_default=func.now())
    updated_at  = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    creator  = relationship("User", foreign_keys=[created_by])
    petition = relationship("Petition", foreign_keys=[petition_id])
    options  = relationship("PollOption", back_populates="poll", cascade="all, delete-orphan", order_by="PollOption.display_order")
    votes    = relationship("PollVote", back_populates="poll", cascade="all, delete-orphan")


class PollOption(Base):
    __tablename__ = "poll_options"

    id            = Column(Integer, primary_key=True, index=True, autoincrement=True)
    poll_id       = Column(Integer, ForeignKey("polls.id", ondelete="CASCADE"), nullable=False, index=True)
    option_text   = Column(String(255), nullable=False)
    display_order = Column(Integer, nullable=False, default=0)

    # Relationships
    poll  = relationship("Poll", back_populates="options")
    votes = relationship("PollVote", back_populates="option", cascade="all, delete-orphan")


class PollVote(Base):
    __tablename__ = "poll_votes"

    id        = Column(Integer, primary_key=True, index=True, autoincrement=True)
    poll_id   = Column(Integer, ForeignKey("polls.id", ondelete="CASCADE"), nullable=False, index=True)
    option_id = Column(Integer, ForeignKey("poll_options.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id   = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    voted_at  = Column(DateTime, nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("poll_id", "user_id", name="uq_poll_user_vote"),
    )

    # Relationships
    poll   = relationship("Poll", back_populates="votes")
    option = relationship("PollOption", back_populates="votes")
    user   = relationship("User", foreign_keys=[user_id])

