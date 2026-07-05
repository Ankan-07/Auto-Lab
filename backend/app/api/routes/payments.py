import hmac
import hashlib
import razorpay
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.payment import Payment
from app.models.deployed_model import DeployedModel

router = APIRouter(prefix="/payments", tags=["Payments"])

def get_razorpay_client():
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Payment system not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env"
        )
    return razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )


class CreateOrderResponse(BaseModel):
    order_id:   str
    amount:     int
    currency:   str
    key_id:     str


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id:   str
    razorpay_payment_id: str
    razorpay_signature:  str


@router.get("/plan")
def get_plan_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    model_count = db.query(DeployedModel).filter(
        DeployedModel.user_id == current_user.id,
        DeployedModel.is_active == True
    ).count()

    from app.models.job import Job
    job_count = db.query(Job).filter(
        Job.user_id == current_user.id,
        Job.status == "completed"
    ).count()

    return {
        "is_pro":        current_user.is_pro,
        "plan":          "pro" if current_user.is_pro else "free",
        "model_count":   model_count,
        "job_count":     job_count,
        "model_limit":   None if current_user.is_pro else settings.FREE_PLAN_MODEL_LIMIT,
        "can_train":     current_user.is_pro or job_count < settings.FREE_PLAN_MODEL_LIMIT,
        "amount":        settings.PRO_PLAN_AMOUNT,
        "currency":      "INR",
    }


@router.post("/create-order", response_model=CreateOrderResponse)
def create_order(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    razorpay_client = get_razorpay_client()

    if current_user.is_pro:
        raise HTTPException(status_code=400, detail="Already on Pro plan")

    order_data = razorpay_client.order.create({
        "amount":   settings.PRO_PLAN_AMOUNT,
        "currency": "INR",
        "payment_capture": 1,
        "notes": {
            "user_id": str(current_user.id),
            "plan":    "pro",
        }
    })

    payment = Payment(
        user_id           = current_user.id,
        razorpay_order_id = order_data["id"],
        amount            = settings.PRO_PLAN_AMOUNT,
        currency          = "INR",
        status            = "created",
        plan              = "pro",
    )
    db.add(payment)
    db.commit()

    return CreateOrderResponse(
        order_id = order_data["id"],
        amount   = settings.PRO_PLAN_AMOUNT,
        currency = "INR",
        key_id   = settings.RAZORPAY_KEY_ID,
    )


@router.post("/verify")
def verify_payment(
    request: VerifyPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    body           = f"{request.razorpay_order_id}|{request.razorpay_payment_id}"
    expected_sig   = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        body.encode(),
        hashlib.sha256
    ).hexdigest()

    if expected_sig != request.razorpay_signature:
        raise HTTPException(status_code=400, detail="Payment verification failed")

    payment = db.query(Payment).filter(
        Payment.razorpay_order_id == request.razorpay_order_id,
        Payment.user_id == current_user.id
    ).first()

    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    payment.razorpay_payment_id = request.razorpay_payment_id
    payment.status              = "paid"
    payment.verified            = True
    payment.paid_at             = datetime.utcnow()

    current_user.is_pro = True

    db.commit()

    return {
        "success": True,
        "message": "Payment verified. You are now on Pro plan! 🎉",
        "is_pro":  True,
    }


@router.post("/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    body      = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")

    expected = hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256
    ).hexdigest()

    if expected != signature:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    import json
    payload = json.loads(body)
    event   = payload.get("event")

    if event == "payment.captured":
        payment_entity = payload["payload"]["payment"]["entity"]
        order_id       = payment_entity.get("order_id")

        payment = db.query(Payment).filter(
            Payment.razorpay_order_id == order_id
        ).first()

        if payment and not payment.verified:
            payment.razorpay_payment_id = payment_entity["id"]
            payment.status              = "paid"
            payment.verified            = True
            payment.paid_at             = datetime.utcnow()

            user = db.query(User).filter(User.id == payment.user_id).first()
            if user:
                user.is_pro = True

            db.commit()

    return {"status": "ok"}