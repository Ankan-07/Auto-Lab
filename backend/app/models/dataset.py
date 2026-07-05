from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, LargeBinary
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class Dataset(Base):
    __tablename__ = "datasets"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    name         = Column(String, nullable=False)
    file_path    = Column(String, nullable=False)
    file_content = Column(LargeBinary, nullable=True)
    file_size    = Column(Integer, nullable=False)
    row_count    = Column(Integer, nullable=True)
    column_count = Column(Integer, nullable=True)
    columns      = Column(JSON, nullable=True)
    target_column= Column(String, nullable=True)
    status       = Column(String, default="uploaded")
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", backref="datasets")
