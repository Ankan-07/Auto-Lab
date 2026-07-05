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

    name         = Column(String, nullable=False)
    model_name   = Column(String, nullable=False)
    problem_type = Column(String, nullable=False)
    accuracy     = Column(Float, nullable=True)
    features     = Column(JSON, nullable=False)
    target_column= Column(String, nullable=False)
    model_path   = Column(String, nullable=False)
    model_blob   = Column(LargeBinary, nullable=True)
    metrics      = Column(JSON, nullable=True)
    is_active    = Column(Boolean, default=True)
    call_count   = Column(Integer, default=0)
    drift_detected     = Column(Boolean, default=False)
    drift_last_checked = Column(DateTime(timezone=True), nullable=True)
    drift_report       = Column(JSON, nullable=True)
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
    name             = Column(String, nullable=True)
    is_active        = Column(Boolean, default=True)
    call_count       = Column(Integer, default=0)
    last_used_at     = Column(DateTime(timezone=True), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    user             = relationship("User", backref="api_keys")
    deployed_model   = relationship("DeployedModel", backref="api_keys")


class PredictionLog(Base):
    __tablename__ = "prediction_logs"

    id                = Column(Integer, primary_key=True, index=True)
    deployed_model_id = Column(Integer, ForeignKey("deployed_models.id"), nullable=False, index=True)
    api_key_id        = Column(Integer, ForeignKey("api_keys.id"), nullable=True, index=True)
    user_id           = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    inputs            = Column(JSON, nullable=False)
    prediction        = Column(JSON, nullable=True)
    probability       = Column(Float, nullable=True)
    latency_ms        = Column(Float, nullable=True)
    source            = Column(String, nullable=True)  # "ui" or "api"
    drift_flagged     = Column(Boolean, default=False)
    created_at        = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    deployed_model    = relationship("DeployedModel", backref="prediction_logs")
    api_key           = relationship("APIKey", backref="prediction_logs")
    user              = relationship("User", backref="prediction_logs")
