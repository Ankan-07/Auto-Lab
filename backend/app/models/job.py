from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Text, LargeBinary
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class Job(Base):
    __tablename__ = "jobs"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    dataset_id  = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    status      = Column(String, default="queued")
    # queued → running → completed / failed

    progress    = Column(Integer, default=0)        # 0-100
    stage       = Column(String, default="queued")  # current pipeline stage
    logs        = Column(JSON, default=list)        # list of log messages
    result      = Column(JSON, nullable=True)       # final results (accuracy etc)
    model_blob  = Column(LargeBinary, nullable=True) # durable trained artifact fallback
    error       = Column(Text, nullable=True)       # error message if failed

    started_at   = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    user    = relationship("User", backref="jobs")
    dataset = relationship("Dataset", backref="jobs")
