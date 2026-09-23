from sqlalchemy import Column, Integer, Text, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class OfficialResponse(Base):
    __tablename__ = "official_responses"

    id          = Column(Integer, primary_key=True, index=True, autoincrement=True)
    petition_id = Column(Integer, ForeignKey("petitions.id", ondelete="CASCADE"), nullable=False)
    official_id = Column(Integer, ForeignKey("users.id",    ondelete="CASCADE"), nullable=False)
    response_text = Column(Text, nullable=False)
    action_taken  = Column(Text, nullable=True)
    created_at    = Column(DateTime, nullable=False, server_default=func.now())

    petition = relationship("Petition")
    official = relationship("User")
