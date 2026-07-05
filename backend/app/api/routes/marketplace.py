import hashlib
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.deployed_model import DeployedModel, APIKey
from app.models.job import Job

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])


def _hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def _api_key_preview(raw_key_or_hash: str) -> str:
    if raw_key_or_hash.startswith("al_live_"):
        return f"{raw_key_or_hash[:12]}...{raw_key_or_hash[-4:]}"
    return "al_live_...hidden"


class PublishRequest(BaseModel):
    deployed_model_id: int
    description:       str
    tags:              Optional[List[str]] = []


class MarketplaceKeyRequest(BaseModel):
    deployed_model_id: int


@router.post("/publish")
def publish_model(
    request: PublishRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    model = db.query(DeployedModel).filter(
        DeployedModel.id        == request.deployed_model_id,
        DeployedModel.user_id   == current_user.id,
        DeployedModel.is_active == True
    ).first()

    if not model:
        raise HTTPException(status_code=404, detail="Deployed model not found")

    return {
        "message":    "Model published to marketplace",
        "model_id":   model.id,
        "description": request.description,
    }


@router.get("/")
def list_marketplace_models(
    search:       Optional[str] = None,
    problem_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(DeployedModel).filter(
        DeployedModel.is_active == True
    )

    if problem_type and problem_type != 'all':
        query = query.filter(
            DeployedModel.problem_type == problem_type
        )

    models = query.order_by(
        DeployedModel.call_count.desc()
    ).limit(50).all()

    if search:
        models = [
            m for m in models
            if search.lower() in m.name.lower() or
               search.lower() in m.model_name.lower()
        ]

    result = []
    for m in models:
        owner = db.query(User).filter(User.id == m.user_id).first()
        owner_display = owner.email.split("@")[0] + "@***" if owner else "anonymous"

        description = ""
        job = db.query(Job).filter(Job.id == m.job_id).first()
        if job and job.result:
            problem_type_str = job.result.get("problem_type", "")
            best_model = job.result.get("best_model", "")
            metrics    = job.result.get("best_metrics", {})
            acc = metrics.get("accuracy") or metrics.get("r2_score")
            acc_str = f"{acc * 100:.1f}%" if acc else "N/A"
            description = (
                f"{problem_type_str.title()} model using {best_model}. "
                f"Accuracy: {acc_str}. "
                f"Predicts '{m.target_column}' from {len(m.features or [])} features."
            )

        result.append({
            "id":           m.id,
            "name":         m.name,
            "model_name":   m.model_name,
            "problem_type": m.problem_type,
            "accuracy":     m.accuracy,
            "features":     m.features,
            "target_column":m.target_column,
            "call_count":   m.call_count,
            "owner":        owner_display,
            "description":  description,
            "endpoint":     f"/deploy/v1/predict",
            "created_at":   m.created_at.isoformat(),
        })

    return result


@router.post("/keys")
def create_marketplace_api_key(
    request: MarketplaceKeyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    model = db.query(DeployedModel).filter(
        DeployedModel.id        == request.deployed_model_id,
        DeployedModel.is_active == True
    ).first()

    if not model:
        raise HTTPException(status_code=404, detail="Marketplace model not found")

    existing_key = db.query(APIKey).filter(
        APIKey.user_id           == current_user.id,
        APIKey.deployed_model_id == model.id,
        APIKey.is_active         == True
    ).first()

    if existing_key:
        return {
            "deployed_model_id": model.id,
            "model_name":        model.name,
            "api_key":           existing_key.key if existing_key.key.startswith("al_live_") else None,
            "api_key_preview":   _api_key_preview(existing_key.key),
            "endpoint":          "/deploy/v1/predict",
            "already_existed":   True,
            "message":           "You already have an API key for this model. Existing hashed keys cannot be shown again.",
        }

    raw_key = f"al_live_{uuid.uuid4().hex}"
    key_hash = _hash_api_key(raw_key)
    api_key = APIKey(
        user_id            = current_user.id,
        deployed_model_id  = model.id,
        key                = key_hash,
        key_hash           = key_hash,
        name               = f"Marketplace key for {model.name}",
        is_active          = True,
    )
    db.add(api_key)
    db.commit()

    return {
        "deployed_model_id": model.id,
        "model_name":        model.name,
        "api_key":           raw_key,
        "api_key_preview":   _api_key_preview(raw_key),
        "endpoint":          "/deploy/v1/predict",
        "already_existed":   False,
        "message":           "API key created. Save it now; it will not be shown again.",
    }


@router.get("/{model_id}")
def get_marketplace_model(model_id: int, db: Session = Depends(get_db)):
    model = db.query(DeployedModel).filter(
        DeployedModel.id        == model_id,
        DeployedModel.is_active == True
    ).first()

    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    owner = db.query(User).filter(User.id == model.user_id).first()
    owner_display = owner.email.split("@")[0] + "@***" if owner else "anonymous"

    return {
        "id":           model.id,
        "name":         model.name,
        "model_name":   model.model_name,
        "problem_type": model.problem_type,
        "accuracy":     model.accuracy,
        "features":     model.features,
        "target_column":model.target_column,
        "metrics":      model.metrics,
        "call_count":   model.call_count,
        "owner":        owner_display,
        "endpoint":     f"/deploy/v1/predict",
        "created_at":   model.created_at.isoformat(),
    }
