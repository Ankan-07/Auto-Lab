import os
from app.workers.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.job import Job
from app.models.dataset import Dataset
from ml.graph import run_agentic_pipeline
from datetime import datetime


def update_job(db, job_id: int, **kwargs):
    db.query(Job).filter(Job.id == job_id).update(kwargs)
    db.commit()


def _run_training(job_id: int):
    db = SessionLocal()
    try:
        job     = db.query(Job).filter(Job.id == job_id).first()
        dataset = db.query(Dataset).filter(
            Dataset.id == job.dataset_id
        ).first()

        if not job or not dataset:
            return

        if not os.path.exists(dataset.file_path) and dataset.file_content:
            os.makedirs(os.path.dirname(dataset.file_path), exist_ok=True)
            with open(dataset.file_path, "wb") as f:
                f.write(dataset.file_content)

        logs = ["🚀 Training job started..."]

        def log_and_save(message: str):
            logs.append(message)
            db.query(Job).filter(Job.id == job_id).update({
                "logs": list(logs)
            })
            db.commit()

        stage_map = {
            "DataCleanerAgent":     ("cleaning",     15),
            "FeatureEngineerAgent": ("engineering",  35),
            "ModelSelectorAgent":   ("training",     55),
            "TunerAgent":           ("tuning",       80),
            "ExplainerAgent":       ("importance",   90),
        }

        def smart_log(message: str):
            for agent_name, (stage, progress) in stage_map.items():
                if agent_name in message:
                    db.query(Job).filter(Job.id == job_id).update({
                        "stage":    stage,
                        "progress": progress,
                    })
                    db.commit()
                    break
            log_and_save(message)

        update_job(db, job_id,
            status="running",
            stage="loading",
            progress=5,
            logs=logs,
            started_at=datetime.utcnow()
        )

        results = run_agentic_pipeline(
            file_path=dataset.file_path,
            target_column=dataset.target_column,
            log_callback=smart_log
        )

        model_path = results.get("model_path") if results else None
        model_blob = None
        if model_path and os.path.exists(model_path):
            with open(model_path, "rb") as f:
                model_blob = f.read()

        update_job(db, job_id,
            status="completed",
            stage="completed",
            progress=100,
            result=results,
            model_blob=model_blob,
            completed_at=datetime.utcnow()
        )

        dataset.status = "ready"
        db.commit()
        log_and_save("🎉 Training complete!")

    except Exception as e:
        db.query(Job).filter(Job.id == job_id).update({
            "status": "failed",
            "stage":  "failed",
            "error":  str(e),
        })
        db.commit()

    finally:
        db.close()


@celery_app.task(bind=True, name="train_model")
def train_model_task(self, job_id: int):
    _run_training(job_id)
