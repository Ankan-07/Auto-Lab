import os
import uuid
import pickle
import hashlib
import numpy as np
import pandas as pd
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import redis as redis_lib

from app.core.config import settings
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.job import Job
from app.models.deployed_model import DeployedModel, APIKey
from app.schemas.deployment import (
    DeployRequest, DeployedModelResponse,
    PredictRequest, PredictionResult
)

router = APIRouter(prefix="/deploy", tags=["Deployment"])

RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_REQUESTS = 60


def _get_redis() -> redis_lib.Redis:
    url = settings.REDIS_URL
    if url.startswith("rediss://"):
        return redis_lib.from_url(url, decode_responses=True, ssl_cert_reqs=None)
    return redis_lib.from_url(url, decode_responses=True)


def _hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def _api_key_preview(raw_key_or_hash: str) -> str:
    if raw_key_or_hash.startswith("al_live_"):
        return f"{raw_key_or_hash[:12]}...{raw_key_or_hash[-4:]}"
    return "al_live_...hidden"


def _check_rate_limit(identifier: str):
    r = _get_redis()
    key = f"rl:{identifier}"
    count = r.incr(key)
    if count == 1:
        r.expire(key, RATE_LIMIT_WINDOW_SECONDS)
    if count > RATE_LIMIT_MAX_REQUESTS:
        ttl = r.ttl(key)
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Try again in {max(ttl, 1)} seconds."
        )


def _restore_model_file(model_record):
    if os.path.exists(model_record.model_path):
        return
    if model_record.model_blob:
        os.makedirs(os.path.dirname(model_record.model_path), exist_ok=True)
        with open(model_record.model_path, "wb") as f:
            f.write(model_record.model_blob)
        return
    raise HTTPException(
        status_code=500,
        detail="Model file not found on disk and no persisted model artifact is available. Please redeploy or retrain."
    )


def _build_prediction_frame(package: dict, request_data: dict):
    features = package["features"]
    cleaning = package.get("cleaning_report") or {}
    engineering = package.get("engineering_report") or {}
    raw_features = cleaning.get("raw_feature_columns") or features
    cleaned_columns = cleaning.get("cleaned_feature_columns") or features

    if all(feature in request_data for feature in features):
        return pd.DataFrame([{feature: float(request_data[feature]) for feature in features}])[features]

    missing_raw = [feature for feature in raw_features if feature not in request_data]
    if missing_raw:
        raise HTTPException(
            status_code=400,
            detail=f"Missing features: {missing_raw}. Required raw features: {raw_features}"
        )

    row = {}
    fill_values = cleaning.get("fill_values") or {}
    feature_dtypes = cleaning.get("feature_dtypes") or {}
    ohe_dummy_columns = cleaning.get("ohe_dummy_columns") or {}
    label_classes = cleaning.get("label_classes") or {}

    for feature in raw_features:
        value = request_data.get(feature, fill_values.get(feature))
        if feature in ohe_dummy_columns:
            value_str = str(value)
            for dummy_col in ohe_dummy_columns[feature]:
                prefix = f"{feature}_"
                category = dummy_col[len(prefix):] if dummy_col.startswith(prefix) else dummy_col
                row[dummy_col] = 1.0 if value_str == category else 0.0
        elif feature in label_classes:
            value_str = str(value)
            classes = label_classes[feature]
            if value_str not in classes:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown category '{value}' for '{feature}'. Allowed: {classes}"
                )
            row[feature] = float(classes.index(value_str))
        else:
            try:
                row[feature] = float(value)
            except (ValueError, TypeError):
                if feature_dtypes.get(feature) == "categorical":
                    raise HTTPException(
                        status_code=400,
                        detail=f"Feature '{feature}' needs a known category from training."
                    )
                raise HTTPException(
                    status_code=400,
                    detail=f"Feature '{feature}' must be numeric. Got: '{value}'."
                )

    df = pd.DataFrame([{col: row.get(col, 0.0) for col in cleaned_columns}])

    to_drop = [col for col in engineering.get("correlated_dropped", []) if col in df.columns]
    if to_drop:
        df = df.drop(columns=to_drop)

    poly_inputs = [col for col in engineering.get("polynomial_input_columns", []) if col in df.columns]
    poly_names = engineering.get("polynomial_feature_names", [])
    if poly_inputs and poly_names:
        from sklearn.preprocessing import PolynomialFeatures
        poly = PolynomialFeatures(degree=2, interaction_only=True, include_bias=False)
        poly_arr = poly.fit_transform(df[poly_inputs])
        n_existing = len(poly_inputs)
        for i, name in enumerate(poly_names):
            df[name] = poly_arr[:, n_existing + i]

    for col in engineering.get("log_transformed", []):
        if col in df.columns:
            df[col] = np.log1p(df[col].astype(float))

    selected = engineering.get("selected_columns") or []
    if selected:
        for col in selected:
            if col not in df.columns:
                df[col] = 0.0
        df = df[selected]

    for feature in features:
        if feature not in df.columns:
            df[feature] = 0.0

    return df[features].astype(float)


def _compute_shap(model, input_arr, features, problem_type):
    """
    Compute SHAP values for a single prediction.
    Tries TreeExplainer first (fast, tree models only).
    Falls back to KernelExplainer (slower but works for any model).
    Returns sorted list of SHAP explanations.
    """
    try:
        import shap

        # Try TreeExplainer first — works for RF, XGB, LightGBM, etc.
        try:
            explainer = shap.TreeExplainer(model)
            shap_vals = explainer.shap_values(input_arr)
        except Exception:
            # Fallback: KernelExplainer works for ANY model
            # Uses a small background dataset (zeros as approximation)
            background = np.zeros((1, len(features)))
            explainer  = shap.KernelExplainer(
                model.predict_proba if (
                    problem_type == "classification" and
                    hasattr(model, "predict_proba")
                ) else model.predict,
                background
            )
            shap_vals = explainer.shap_values(input_arr, nsamples=100)

        # Handle different output shapes
        if problem_type == "classification":
            if isinstance(shap_vals, list):
                # Multi-class or binary from TreeExplainer
                # Take positive class (index 1 for binary)
                sv = shap_vals[1][0] if len(shap_vals) > 1 else shap_vals[0][0]
            elif isinstance(shap_vals, np.ndarray):
                if shap_vals.ndim == 3:
                    # Shape: (samples, features, classes) — take class 1
                    sv = shap_vals[0, :, 1]
                elif shap_vals.ndim == 2:
                    sv = shap_vals[0]
                else:
                    sv = shap_vals
            else:
                sv = shap_vals[0]
        else:
            # Regression
            if isinstance(shap_vals, list):
                sv = shap_vals[0][0]
            elif isinstance(shap_vals, np.ndarray):
                if shap_vals.ndim == 2:
                    sv = shap_vals[0]
                else:
                    sv = shap_vals
            else:
                sv = shap_vals

        # Build explanation list
        explanation = []
        for i, feature in enumerate(features):
            val = float(sv[i]) if i < len(sv) else 0.0
            explanation.append({
                "feature":    feature,
                "value":      None,   # filled by caller
                "shap_value": round(val, 4),
                "direction":  "increases" if val > 0 else "decreases",
                "magnitude":  round(abs(val), 4),
            })

        return sorted(explanation, key=lambda x: x["magnitude"], reverse=True)

    except Exception as e:
        return []


def _generate_plain_english(
    prediction, shap_explanation: list,
    problem_type: str, target: str,
    probability: float = None
) -> str:
    if not shap_explanation:
        if problem_type == "classification":
            prob_str = f" (confidence: {probability * 100:.1f}%)" if probability else ""
            return f"The model predicted class {prediction}{prob_str}."
        else:
            return f"The model predicted {target} = {prediction:.4f}."

    top_factors = [f for f in shap_explanation[:3] if f["magnitude"] > 0]

    if problem_type == "classification":
        prob_str    = f" (confidence: {probability * 100:.1f}%)" if probability else ""
        explanation = f"The model predicted class {prediction}{prob_str}. "
        if top_factors:
            explanation += "The main reasons are: "
            reasons = []
            for f in top_factors:
                direction = "increases" if f["direction"] == "increases" else "decreases"
                reasons.append(
                    f"{f['feature']} = {f['value']} "
                    f"({direction} the prediction by {f['magnitude']:.4f})"
                )
            explanation += ", ".join(reasons) + "."
    else:
        explanation = f"The model predicted {target} = {prediction:.4f}. "
        if top_factors:
            explanation += "Top factors driving this: "
            reasons = []
            for f in top_factors:
                direction = "pushed it higher" if f["direction"] == "increases" \
                            else "pushed it lower"
                reasons.append(
                    f"{f['feature']} = {f['value']} ({direction} by {f['magnitude']:.4f})"
                )
            explanation += ", ".join(reasons) + "."

    return explanation


# ─────────────────────────────────────────────────────────
# DEPLOY
# ─────────────────────────────────────────────────────────

@router.post("/", response_model=dict, status_code=201)
def deploy_model(
    request: DeployRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = db.query(Job).filter(
        Job.id      == request.job_id,
        Job.user_id == current_user.id
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job not completed. Status: {job.status}"
        )

    result = job.result
    if not result:
        raise HTTPException(status_code=400, detail="No results found for this job")

    model_path = result.get("model_path")
    if not model_path or not os.path.exists(model_path):
        if job.model_blob and model_path:
            os.makedirs(os.path.dirname(model_path), exist_ok=True)
            with open(model_path, "wb") as f:
                f.write(job.model_blob)
        else:
            raise HTTPException(
                status_code=400,
                detail="Trained model artifact not found. Please retrain the model first."
            )

    # Already deployed?
    existing = db.query(DeployedModel).filter(
        DeployedModel.job_id    == request.job_id,
        DeployedModel.user_id   == current_user.id,
        DeployedModel.is_active == True
    ).first()

    if existing:
        api_key = db.query(APIKey).filter(
            APIKey.deployed_model_id == existing.id,
            APIKey.is_active         == True
        ).first()
        return {
            "deployed_model_id": existing.id,
            "api_key":           api_key.key if api_key and api_key.key.startswith("al_live_") else None,
            "api_key_preview":   _api_key_preview(api_key.key if api_key else "") if api_key else None,
            "message":           "Model already deployed",
            "already_existed":   True,
        }

    target_column = ""
    if hasattr(job, 'dataset') and job.dataset:
        target_column = job.dataset.target_column or ""

    metrics    = result.get("best_metrics") or {}
    accuracy   = metrics.get("accuracy") or metrics.get("r2_score")
    model_blob = job.model_blob
    if not model_blob and model_path and os.path.exists(model_path):
        with open(model_path, "rb") as f:
            model_blob = f.read()

    deployed = DeployedModel(
        user_id       = current_user.id,
        job_id        = request.job_id,
        dataset_id    = job.dataset_id,
        name          = request.name,
        model_name    = result.get("best_model", "Unknown"),
        problem_type  = result.get("problem_type", "classification"),
        accuracy      = accuracy,
        features      = result.get("features", []),
        target_column = target_column,
        model_path    = model_path,
        model_blob    = model_blob,
        metrics       = metrics,
        is_active     = True,
    )
    db.add(deployed)
    db.commit()
    db.refresh(deployed)

    raw_key = f"al_live_{uuid.uuid4().hex}"
    api_key = APIKey(
        user_id           = current_user.id,
        deployed_model_id = deployed.id,
        key               = _hash_api_key(raw_key),
        key_hash          = _hash_api_key(raw_key),
        name              = f"Key for {request.name}",
        is_active         = True,
    )
    db.add(api_key)
    db.commit()

    return {
        "deployed_model_id": deployed.id,
        "api_key":           raw_key,
        "message":           "Model deployed successfully",
        "already_existed":   False,
    }


# ─────────────────────────────────────────────────────────
# LIST DEPLOYED MODELS
# ─────────────────────────────────────────────────────────

@router.get("/models", response_model=List[DeployedModelResponse])
def list_deployed_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    models = db.query(DeployedModel).filter(
        DeployedModel.user_id   == current_user.id,
        DeployedModel.is_active == True
    ).order_by(DeployedModel.created_at.desc()).all()

    # Return with job_id included
    result = []
    for m in models:
        result.append({
            "id":           m.id,
            "job_id":       m.job_id,
            "name":         m.name,
            "model_name":   m.model_name,
            "problem_type": m.problem_type,
            "accuracy":     m.accuracy,
            "features":     m.features,
            "target_column":m.target_column,
            "metrics":      m.metrics,
            "is_active":    m.is_active,
            "call_count":   m.call_count,
            "created_at":   m.created_at,
        })
    return result

# ─────────────────────────────────────────────────────────
# GET ONE DEPLOYED MODEL
# ─────────────────────────────────────────────────────────

@router.get("/models/{model_id}")
def get_deployed_model(
    model_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    model = db.query(DeployedModel).filter(
        DeployedModel.id      == model_id,
        DeployedModel.user_id == current_user.id
    ).first()

    if not model:
        raise HTTPException(status_code=404, detail="Deployed model not found")

    api_key = db.query(APIKey).filter(
        APIKey.deployed_model_id == model_id,
        APIKey.is_active         == True
    ).first()

    input_features = model.features
    try:
        _restore_model_file(model)
        with open(model.model_path, "rb") as f:
            package = pickle.load(f)
        input_features = package.get("input_features") or model.features
    except Exception:
        pass

    return {
        "id":           model.id,
        "name":         model.name,
        "model_name":   model.model_name,
        "problem_type": model.problem_type,
        "accuracy":     model.accuracy,
        "features":     model.features,
        "input_features": input_features,
        "target_column":model.target_column,
        "metrics":      model.metrics,
        "call_count":   model.call_count,
        "created_at":   model.created_at,
        "api_key":      api_key.key if api_key and api_key.key.startswith("al_live_") else None,
        "api_key_preview": _api_key_preview(api_key.key if api_key else "") if api_key else None,
    }


# ─────────────────────────────────────────────────────────
# PREDICT — JWT authenticated (prediction tester UI)
# ─────────────────────────────────────────────────────────

@router.post("/predict/{model_id}", response_model=PredictionResult)
def predict(
    model_id: int,
    request: PredictRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    model_record = db.query(DeployedModel).filter(
        DeployedModel.id        == model_id,
        DeployedModel.user_id   == current_user.id,
        DeployedModel.is_active == True
    ).first()

    if not model_record:
        raise HTTPException(status_code=404, detail="Model not found")

    _restore_model_file(model_record)

    with open(model_record.model_path, "rb") as f:
        package = pickle.load(f)

    model        = package["model"]
    scaler       = package["scaler"]
    features     = package["features"]
    problem_type = package["problem_type"]
    model_name   = package["model_name"]
    target       = package["target"]

    input_df  = _build_prediction_frame(package, request.data)
    input_arr = scaler.transform(input_df)

    # Predict
    prediction = model.predict(input_arr)[0]

    probability      = None
    prediction_label = None

    if problem_type == "classification":
        if hasattr(model, "predict_proba"):
            proba       = model.predict_proba(input_arr)[0]
            probability = float(max(proba))
        target_classes = (package.get("cleaning_report") or {}).get("target_classes") or []
        prediction_index = int(prediction)
        prediction_label = target_classes[prediction_index] if prediction_index < len(target_classes) else str(prediction_index)
        prediction_val   = prediction_index
    else:
        prediction_val = float(round(float(prediction), 4))

    # SHAP
    shap_explanation = _compute_shap(model, input_arr, features, problem_type)

    # Fill in actual values
    for item in shap_explanation:
        item["value"] = float(input_df.iloc[0].get(item["feature"], 0.0))

    plain_english = _generate_plain_english(
        prediction_val, shap_explanation,
        problem_type, target, probability
    )

    model_record.call_count += 1
    db.commit()

    return PredictionResult(
        prediction        = prediction_val,
        prediction_label  = prediction_label,
        probability       = probability,
        shap_explanation  = shap_explanation,
        plain_english     = plain_english,
        model_name        = model_name,
        problem_type      = problem_type,
    )


# ─────────────────────────────────────────────────────────
# PUBLIC PREDICT — API key authenticated (external apps)
# ─────────────────────────────────────────────────────────

@router.post("/v1/predict")
def public_predict(
    request: PredictRequest,
    api_key: str,
    db: Session = Depends(get_db)
):
    hashed_key = _hash_api_key(api_key)
    key_record = db.query(APIKey).filter(
        APIKey.key_hash  == hashed_key,
        APIKey.is_active == True
    ).first()

    if not key_record:
        raise HTTPException(status_code=401, detail="Invalid API key")

    _check_rate_limit(key_record.key_hash or _hash_api_key(key_record.key))

    model_record = db.query(DeployedModel).filter(
        DeployedModel.id        == key_record.deployed_model_id,
        DeployedModel.is_active == True
    ).first()

    if not model_record:
        raise HTTPException(status_code=404, detail="Model not found")

    _restore_model_file(model_record)

    with open(model_record.model_path, "rb") as f:
        package = pickle.load(f)

    model        = package["model"]
    scaler       = package["scaler"]
    features     = package["features"]
    problem_type = package["problem_type"]
    target       = package["target"]

    input_df  = _build_prediction_frame(package, request.data)
    input_arr = scaler.transform(input_df)
    prediction = model.predict(input_arr)[0]

    probability = None
    if problem_type == "classification" and hasattr(model, "predict_proba"):
        proba       = model.predict_proba(input_arr)[0]
        probability = float(max(proba))

    shap_explanation = _compute_shap(model, input_arr, features, problem_type)
    for item in shap_explanation:
        item["value"] = float(input_df.iloc[0].get(item["feature"], 0.0))

    prediction_value = int(prediction) if problem_type == "classification" else float(prediction)
    prediction_label = None
    if problem_type == "classification":
        target_classes = (package.get("cleaning_report") or {}).get("target_classes") or []
        prediction_label = target_classes[prediction_value] if prediction_value < len(target_classes) else str(prediction_value)

    plain_english = _generate_plain_english(
        prediction_value, shap_explanation,
        problem_type, target, probability
    )

    key_record.call_count   += 1
    key_record.last_used_at  = datetime.utcnow()
    model_record.call_count += 1
    db.commit()

    return {
        "prediction":       prediction_value,
        "prediction_label": prediction_label,
        "probability":      probability,
        "shap_explanation": shap_explanation,
        "plain_english":    plain_english,
        "model":            package["model_name"],
    }
