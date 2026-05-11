from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class Payment(Base):
    __tablename__ = "payments"

    id                 = Column(Integer, primary_key=True, index=True)
    user_id            = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Razorpay IDs
    razorpay_order_id  = Column(String, unique=True, nullable=False)
    razorpay_payment_id= Column(String, nullable=True)  # filled after payment

    amount             = Column(Integer, nullable=False)  # in paise
    currency           = Column(String, default="INR")
    status             = Column(String, default="created")
    # created → paid → failed

    plan               = Column(String, default="pro")
    verified           = Column(Boolean, default=False)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())
    paid_at            = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", backref="payments")