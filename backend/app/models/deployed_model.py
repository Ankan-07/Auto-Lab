from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean, Text, LargeBinary
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class DeployedModel(Base):
    __tablename__ = "deployed_models"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_id       = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    dataset_id   = Column(Integer, ForeignKey("datasets.id"), nullable=False)

    name         = Column(String, nullable=False)       # user-given name
    model_name   = Column(String, nullable=False)       # e.g. "Gradient Boosting"
    problem_type = Column(String, nullable=False)       # classification / regression
    accuracy     = Column(Float, nullable=True)         # primary score
    features     = Column(JSON, nullable=False)         # list of feature names
    target_column= Column(String, nullable=False)
    model_path   = Column(String, nullable=False)       # path to saved .pkl file
    model_blob   = Column(LargeBinary, nullable=True)   # durable deployed artifact fallback
    metrics      = Column(JSON, nullable=True)          # full metrics dict
    is_active    = Column(Boolean, default=True)
    call_count   = Column(Integer, default=0)           # how many times called
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    user    = relationship("User", backref="deployed_models")
    job     = relationship("Job", backref="deployed_model")
    dataset = relationship("Dataset", backref="deployed_model")


class APIKey(Base):
    __tablename__ = "api_keys"

    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False)
    deployed_model_id= Column(Integer, ForeignKey("deployed_models.id"), nullable=False)

    key              = Column(String, unique=True, nullable=False, index=True)
    key_hash         = Column(String, unique=True, nullable=True, index=True)
    name             = Column(String, nullable=True)     # user label
    is_active        = Column(Boolean, default=True)
    call_count       = Column(Integer, default=0)
    last_used_at     = Column(DateTime(timezone=True), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    user             = relationship("User", backref="api_keys")
    deployed_model   = relationship("DeployedModel", backref="api_keys")
