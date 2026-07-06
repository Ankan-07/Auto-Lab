from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import auth, datasets, deployment, payments, marketplace
from app.core.database import engine, Base
from app.models import user, dataset, job, deployed_model, payment
from sqlalchemy import inspect, text

Base.metadata.create_all(bind=engine)


def ensure_runtime_columns():
    additions = {
        "datasets": {
            "file_content": "BYTEA" if engine.dialect.name == "postgresql" else "BLOB",
        },
        "jobs": {
            "model_blob": "BYTEA" if engine.dialect.name == "postgresql" else "BLOB",
        },
        "deployed_models": {
            "model_blob": "BYTEA" if engine.dialect.name == "postgresql" else "BLOB",
        },
        "api_keys": {
            "key_hash": "VARCHAR",
        },
    }

    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in additions.items():
            existing = {col["name"] for col in inspector.get_columns(table)}
            for name, col_type in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {col_type}"))


ensure_runtime_columns()

app = FastAPI(
    title="AutoLab API",
    description="AutoML Platform API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://ml-foundry.vercel.app",
        "https://ml-foundry-git-main-kashishroys-projects.vercel.app",
        "https://ml-foundry-lxfz8uhzu-kashishroys-projects.vercel.app",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(datasets.router)
app.include_router(deployment.router)
app.include_router(payments.router)
app.include_router(marketplace.router)

@app.get("/")
def health_check():
    return {"status": "AutoLab API is running 🚀"}
