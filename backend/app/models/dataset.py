from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, LargeBinary
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class Dataset(Base):
    __tablename__ = "datasets"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    name         = Column(String, nullable=False)       # original filename
    file_path    = Column(String, nullable=False)       # where file is stored
    file_content = Column(LargeBinary, nullable=True)   # durable fallback for Render's ephemeral disk
    file_size    = Column(Integer, nullable=False)      # bytes
    row_count    = Column(Integer, nullable=True)       # how many rows
    column_count = Column(Integer, nullable=True)       # how many columns
    columns      = Column(JSON, nullable=True)          # list of column names
    target_column= Column(String, nullable=True)        # which column to predict
    status       = Column(String, default="uploaded")   # uploaded / processing / ready
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    # relationship — one user has many datasets
    user = relationship("User", backref="datasets")
