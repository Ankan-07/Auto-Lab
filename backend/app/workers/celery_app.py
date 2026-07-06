from celery import Celery
from app.core.config import settings

def get_redis_url():
    url = settings.REDIS_URL
    if not url:
        return "redis://localhost:6379/0"
    if url.startswith("rediss://") and "ssl_cert_reqs" not in url:
        url = url + "?ssl_cert_reqs=CERT_NONE"
    return url

redis_url = get_redis_url()

celery_app = Celery(
    "omniml",
    broker=redis_url,
    backend=redis_url,
    include=["app.workers.tasks", "app.workers.drift"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "check-drift-daily": {
            "task": "check_drift_for_all_models",
            "schedule": 24 * 60 * 60,
        },
    },
)

if redis_url.startswith("rediss://"):
    celery_app.conf.update(
        broker_use_ssl={"ssl_cert_reqs": "CERT_NONE"},
        redis_backend_use_ssl={"ssl_cert_reqs": "CERT_NONE"},
    )