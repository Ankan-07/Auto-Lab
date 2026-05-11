import uuid
import io
import os
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.dataset import Dataset
from app.models.job import Job
from app.schemas.dataset import DatasetResponse, JobResponse, UploadResponse
from app.services.storage import save_file, delete_file

router = APIRouter(prefix="/datasets", tags=["Datasets"])


@router.post("/upload", response_model=UploadResponse, status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    target_column: str = Form(...),
    force_retrain: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    allowed = ('.csv', '.xlsx', '.xls', '.json', '.parquet', '.tsv')
    if not any(file.filename.lower().endswith(ext) for ext in allowed):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed)}"
        )

    if not current_user.is_pro:
        from app.core.config import settings
        completed_jobs = db.query(Job).filter(
            Job.user_id == current_user.id,
            Job.status  == "completed"
        ).count()
        if completed_jobs >= settings.FREE_PLAN_MODEL_LIMIT:
            raise HTTPException(
                status_code=403,
                detail=f"Free plan limit reached ({settings.FREE_PLAN_MODEL_LIMIT} models). "
                       f"Upgrade to Pro for unlimited models."
            )

    content   = await file.read()
    file_size = len(content)

    if file_size > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum 50MB")

    try:
        fname = file.filename.lower()
        if fname.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif fname.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content))
        elif fname.endswith('.json'):
            df = pd.read_json(io.BytesIO(content))
        elif fname.endswith('.parquet'):
            df = pd.read_parquet(io.BytesIO(content))
        elif fname.endswith('.tsv'):
            df = pd.read_csv(io.BytesIO(content), sep='\t')
        else:
            raise ValueError("Unsupported format")

        row_count    = len(df)
        column_count = len(df.columns)
        columns      = df.columns.tolist()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {str(e)}")

    if target_column not in columns:
        raise HTTPException(
            status_code=400,
            detail=f"Target column '{target_column}' not found. Available: {columns}"
        )

    # Cache check — must match filename, size AND target column
    if not force_retrain:
        existing_dataset = db.query(Dataset).filter(
            Dataset.user_id       == current_user.id,
            Dataset.name          == file.filename,
            Dataset.file_size     == file_size,
            Dataset.target_column == target_column,
        ).first()

        if existing_dataset:
            existing_job = db.query(Job).filter(
                Job.dataset_id == existing_dataset.id,
                Job.status     == "completed"
            ).first()
            if existing_job:
                return UploadResponse(
                    job_id        = existing_job.id,
                    dataset       = existing_dataset,
                    cached        = True,
                    cache_message = (
                    f"A trained model already exists for '{file.filename}' "
                    f"with target '{target_column}'. Showing cached results. "
                    f"Use Force Retrain to train again."
                )
                )

    # Save file
    await file.seek(0)
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path       = save_file(file, unique_filename)

    dataset = Dataset(
        user_id       = current_user.id,
        name          = file.filename,
        file_path     = file_path,
        file_content  = content,
        file_size     = file_size,
        row_count     = row_count,
        column_count  = column_count,
        columns       = columns,
        target_column = target_column,
        status        = "uploaded"
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    job = Job(
        user_id    = current_user.id,
        dataset_id = dataset.id,
        status     = "queued",
        progress   = 0,
        stage      = "queued",
        logs       = ["Job created, waiting to start..."]
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    from app.workers.tasks import train_model_task
    train_model_task.delay(job.id)

    return UploadResponse(job_id=job.id, dataset=dataset)


@router.post("/{dataset_id}/retrain")
def retrain_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrain using existing dataset file on disk."""
    dataset = db.query(Dataset).filter(
        Dataset.id      == dataset_id,
        Dataset.user_id == current_user.id
    ).first()

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Check if file exists on disk
    file_exists = os.path.exists(dataset.file_path)

    if not file_exists:
        if dataset.file_content:
            os.makedirs(os.path.dirname(dataset.file_path), exist_ok=True)
            with open(dataset.file_path, "wb") as f:
                f.write(dataset.file_content)
        else:
            raise HTTPException(
                status_code=409,
                detail={
                    "error":         "file_not_on_disk",
                    "message":       "File not found on server disk and this older dataset has no persisted copy. Please re-upload.",
                    "dataset_name":  dataset.name,
                    "target_column": dataset.target_column,
                    "columns":       dataset.columns,
                }
            )

    if not current_user.is_pro:
        from app.core.config import settings
        completed_jobs = db.query(Job).filter(
            Job.user_id == current_user.id,
            Job.status  == "completed"
        ).count()
        if completed_jobs >= settings.FREE_PLAN_MODEL_LIMIT:
            raise HTTPException(
                status_code=403,
                detail="Free plan limit reached. Upgrade to Pro."
            )

    existing_versions = db.query(Job).filter(
        Job.dataset_id == dataset_id
    ).count()

    job = Job(
        user_id    = current_user.id,
        dataset_id = dataset.id,
        status     = "queued",
        progress   = 0,
        stage      = "queued",
        logs       = [f"🔄 Retrain job started (version {existing_versions + 1})..."]
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    from app.workers.tasks import train_model_task
    train_model_task.delay(job.id)

    return {
        "job_id":  job.id,
        "version": existing_versions + 1,
        "message": f"Retraining started (version {existing_versions + 1})"
    }


@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.deployed_model import DeployedModel
    from sqlalchemy import func

    total_jobs = db.query(Job).filter(
        Job.user_id == current_user.id,
        Job.status  == "completed"
    ).count()

    total_datasets = db.query(Dataset).filter(
        Dataset.user_id == current_user.id
    ).count()

    total_deployed = db.query(DeployedModel).filter(
        DeployedModel.user_id   == current_user.id,
        DeployedModel.is_active == True
    ).count()

    total_api_calls = db.query(
        func.sum(DeployedModel.call_count)
    ).filter(
        DeployedModel.user_id == current_user.id
    ).scalar() or 0

    recent_jobs = db.query(Job).filter(
        Job.user_id == current_user.id,
        Job.status  == "completed"
    ).order_by(Job.created_at.desc()).limit(10).all()

    recent_models = []
    for job in recent_jobs:
        if job.result:
            dataset = db.query(Dataset).filter(
                Dataset.id == job.dataset_id
            ).first()
            recent_models.append({
                "job_id":       job.id,
                "name":         dataset.name if dataset else f"Job #{job.id}",
                "best_model":   job.result.get("best_model", "Unknown"),
                "problem_type": job.result.get("problem_type", "unknown"),
                "accuracy":     (job.result.get("best_metrics") or {}).get("accuracy") or
                                (job.result.get("best_metrics") or {}).get("r2_score"),
                "created_at":   job.created_at.isoformat(),
            })

    accuracies = []
    for job in db.query(Job).filter(
        Job.user_id == current_user.id,
        Job.status  == "completed"
    ).all():
        if job.result and job.result.get("best_metrics"):
            acc = job.result["best_metrics"].get("accuracy") or \
                  job.result["best_metrics"].get("r2_score")
            if acc:
                accuracies.append(acc)

    avg_accuracy = round(
        sum(accuracies) / len(accuracies) * 100, 1
    ) if accuracies else None

    return {
        "total_models":    total_jobs,
        "total_datasets":  total_datasets,
        "total_deployed":  total_deployed,
        "total_api_calls": total_api_calls,
        "avg_accuracy":    avg_accuracy,
        "recent_models":   recent_models,
    }


@router.get("/jobs/{job_id}/results")
def get_job_results(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = db.query(Job).filter(
        Job.id == job_id, Job.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job not completed yet. Status: {job.status}"
        )
    return job.result


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job_status(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = db.query(Job).filter(
        Job.id == job_id, Job.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/", response_model=List[DatasetResponse])
def get_datasets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Dataset).filter(
        Dataset.user_id == current_user.id
    ).order_by(Dataset.created_at.desc()).all()


@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id, Dataset.user_id == current_user.id
    ).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


@router.delete("/{dataset_id}", status_code=204)
def delete_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id, Dataset.user_id == current_user.id
    ).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    delete_file(dataset.file_path)
    db.delete(dataset)
    db.commit()
