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

# Initialize Razorpay client
# This talks to Razorpay's servers using your credentials
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


# ─────────────────────────────────────────────────
# GET CURRENT PLAN INFO
# ─────────────────────────────────────────────────

@router.get("/plan")
def get_plan_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns current user's plan details.
    Frontend uses this to show upgrade prompts.
    """
    # Count how many models user has trained
    model_count = db.query(DeployedModel).filter(
        DeployedModel.user_id == current_user.id,
        DeployedModel.is_active == True
    ).count()

    # Count datasets (training jobs)
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


# ─────────────────────────────────────────────────
# CREATE RAZORPAY ORDER
# ─────────────────────────────────────────────────

@router.post("/create-order", response_model=CreateOrderResponse)
def create_order(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 1 of payment flow.
    Creates a Razorpay order and returns order_id to frontend.
    Frontend uses order_id to open Razorpay checkout.
    """
    razorpay_client = get_razorpay_client()  # FIX: was never instantiated

    if current_user.is_pro:
        raise HTTPException(status_code=400, detail="Already on Pro plan")

    # Create order with Razorpay
    # This makes an API call to Razorpay servers
    order_data = razorpay_client.order.create({
        "amount":   settings.PRO_PLAN_AMOUNT,  # 49900 paise = ₹499
        "currency": "INR",
        "payment_capture": 1,   # auto-capture payment (don't hold)
        "notes": {
            "user_id": str(current_user.id),
            "plan":    "pro",
        }
    })

    # Save order to our database
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


# ─────────────────────────────────────────────────
# VERIFY PAYMENT (called after user pays)
# ─────────────────────────────────────────────────

@router.post("/verify")
def verify_payment(
    request: VerifyPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 2 of payment flow.
    After user pays in Razorpay checkout, frontend sends the
    payment details here for verification.

    We verify the signature to confirm payment is genuine
    (not someone faking a successful payment).
    """
    # Verify signature
    # Razorpay creates a signature using HMAC-SHA256
    # We recreate it and compare — if they match, payment is real
    body           = f"{request.razorpay_order_id}|{request.razorpay_payment_id}"
    expected_sig   = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        body.encode(),
        hashlib.sha256
    ).hexdigest()

    if expected_sig != request.razorpay_signature:
        raise HTTPException(status_code=400, detail="Payment verification failed")

    # Find the payment record
    payment = db.query(Payment).filter(
        Payment.razorpay_order_id == request.razorpay_order_id,
        Payment.user_id == current_user.id
    ).first()

    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    # Update payment record
    payment.razorpay_payment_id = request.razorpay_payment_id
    payment.status              = "paid"
    payment.verified            = True
    payment.paid_at             = datetime.utcnow()

    # Upgrade user to Pro!
    current_user.is_pro = True

    db.commit()

    return {
        "success": True,
        "message": "Payment verified. You are now on Pro plan! 🎉",
        "is_pro":  True,
    }


# ─────────────────────────────────────────────────
# RAZORPAY WEBHOOK (Razorpay calls this, not user)
# ─────────────────────────────────────────────────

@router.post("/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Razorpay calls this URL automatically when payment status changes.
    This is a backup — in case user closes browser after paying
    but before verify() is called.

    Webhook = Razorpay calls YOU (not the other way around).
    """
    body      = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")

    # Verify webhook signature
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
        # Payment successful!
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

            # Upgrade user
            user = db.query(User).filter(User.id == payment.user_id).first()
            if user:
                user.is_pro = True

            db.commit()

    return {"status": "ok"}