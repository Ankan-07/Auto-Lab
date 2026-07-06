"""
Daily input-data drift detection for every active deployed model.

Compares recent prediction inputs (last 7 days from PredictionLog) against the
training distribution stored in the deployed model's training result.

We use the Population Stability Index (PSI) per numeric feature:
    PSI = sum((expected_pct - actual_pct) * ln(expected_pct / actual_pct))

A feature with PSI > 0.2 is considered "drifted". If at least one feature
crosses the threshold, the DeployedModel is flagged drift_detected=True.
"""
import math
from datetime import datetime, timedelta
from typing import Iterable

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.deployed_model import DeployedModel, PredictionLog
from app.models.job import Job
from app.workers.celery_app import celery_app


PSI_THRESHOLD = 0.2
PSI_BINS = 10
LOOKBACK_DAYS = 7
MIN_RECENT_SAMPLES = 30


def _psi(expected: np.ndarray, actual: np.ndarray, bins: int = PSI_BINS) -> float:
    expected = expected[~np.isnan(expected)]
    actual = actual[~np.isnan(actual)]
    if len(expected) < 2 or len(actual) < 2:
        return 0.0

    edges = np.quantile(expected, np.linspace(0, 1, bins + 1))
    edges = np.unique(edges)
    if len(edges) < 3:
        return 0.0
    edges[0] = -np.inf
    edges[-1] = np.inf

    e_counts, _ = np.histogram(expected, bins=edges)
    a_counts, _ = np.histogram(actual, bins=edges)

    epsilon = 1e-6
    e_pct = (e_counts / e_counts.sum()) + epsilon
    a_pct = (a_counts / a_counts.sum()) + epsilon

    return float(np.sum((e_pct - a_pct) * np.log(e_pct / a_pct)))


def _baseline_for_feature(job: Job, feature: str) -> np.ndarray | None:
    """
    Returns the training-time distribution for one feature.

    The Job.result dict doesn't store raw column samples, so we fall back to
    the original dataset file referenced by the Job.dataset. If that's also
    unavailable, drift can't be computed for this feature.
    """
    if not job or not job.dataset:
        return None
    dataset = job.dataset
    file_path = getattr(dataset, "file_path", None)
    if not file_path:
        return None
    try:
        import os
        if not os.path.exists(file_path):
            return None
        if file_path.lower().endswith(".csv"):
            df = pd.read_csv(file_path, usecols=lambda c: c == feature)
        elif file_path.lower().endswith((".xlsx", ".xls")):
            df = pd.read_excel(file_path, usecols=[feature])
        elif file_path.lower().endswith(".parquet"):
            df = pd.read_parquet(file_path, columns=[feature])
        else:
            df = pd.read_csv(file_path, usecols=lambda c: c == feature)
        if feature not in df.columns:
            return None
        values = pd.to_numeric(df[feature], errors="coerce").to_numpy()
        return values
    except Exception:
        return None


def _check_model_drift(db: Session, model: DeployedModel) -> dict:
    cutoff = datetime.utcnow() - timedelta(days=LOOKBACK_DAYS)
    logs: Iterable[PredictionLog] = db.query(PredictionLog).filter(
        PredictionLog.deployed_model_id == model.id,
        PredictionLog.created_at >= cutoff,
    ).all()

    rows = [log.inputs for log in logs if isinstance(log.inputs, dict)]
    if len(rows) < MIN_RECENT_SAMPLES:
        return {
            "status": "insufficient_samples",
            "samples": len(rows),
            "required": MIN_RECENT_SAMPLES,
        }

    recent_df = pd.DataFrame(rows)
    job = db.query(Job).filter(Job.id == model.job_id).first()

    per_feature: dict = {}
    drifted_features = []
    for feature in recent_df.columns:
        baseline = _baseline_for_feature(job, feature)
        if baseline is None:
            continue
        actual = pd.to_numeric(recent_df[feature], errors="coerce").to_numpy()
        psi = _psi(baseline, actual)
        if math.isnan(psi) or math.isinf(psi):
            continue
        per_feature[feature] = round(psi, 4)
        if psi > PSI_THRESHOLD:
            drifted_features.append(feature)

    drift_detected = bool(drifted_features)

    model.drift_detected = drift_detected
    model.drift_last_checked = datetime.utcnow()
    model.drift_report = {
        "threshold": PSI_THRESHOLD,
        "psi": per_feature,
        "drifted_features": drifted_features,
        "samples_checked": len(rows),
        "computed_at": datetime.utcnow().isoformat(),
    }
    db.commit()

    return {
        "status": "ok",
        "drift_detected": drift_detected,
        "drifted_features": drifted_features,
        "samples": len(rows),
    }


@celery_app.task(name="check_drift_for_all_models")
def check_drift_for_all_models():
    db = SessionLocal()
    results = []
    try:
        models = db.query(DeployedModel).filter(
            DeployedModel.is_active == True
        ).all()
        for model in models:
            try:
                results.append({
                    "model_id": model.id,
                    **_check_model_drift(db, model),
                })
            except Exception as exc:
                db.rollback()
                results.append({"model_id": model.id, "status": "error", "error": str(exc)})
    finally:
        db.close()
    return results
