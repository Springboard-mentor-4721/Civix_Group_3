from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Signature(Base):
    __tablename__ = "signatures"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    petition_id = Column(Integer, ForeignKey("petitions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, server_default=func.now(), nullable=False)
