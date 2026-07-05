# AutoLab — Improvement TODO List

> Generated from production-grade review, resume analysis, and LangGraph architecture discussion.
> Work through phases in order — later phases have dependencies on earlier ones.

---

## Phase 1 — Bug Fixes & Security
> Do these first. Things are actively broken or insecure.

- [x] **#1 Fix distributed rate limiting — replace in-memory dict with Redis**
  - `deployment.py:27` uses `_rate_limit_buckets` as a plain Python dict
  - With multiple Celery workers, each process has its own counter — limits are never enforced across instances
  - Replace with `redis.incr()` + `expire()` using the existing Redis connection
  - File: `backend/app/api/routes/deployment.py`

- [x] **#2 Remove raw API key fallback in `public_predict`**
  - `deployment.py:556-558` accepts the plaintext key if the hash lookup fails
  - This undermines key hashing entirely
  - Delete the fallback `if not key_record` block that queries by `APIKey.key == api_key`
  - File: `backend/app/api/routes/deployment.py` → `public_predict()`

- [x] **#3 Remove threading fallback in `tasks.py`**
  - `tasks.py:115` has `run_training_direct()` that spins a raw daemon thread when Celery is unavailable
  - Threads share memory, have no retry logic, and no visibility
  - Remove it entirely and require Celery — update `docker-compose.yml` to make `celery_worker` mandatory
  - File: `backend/app/workers/tasks.py`

---

## Phase 2 — CI/CD Foundation

- [ ] **#4 Add unit tests for ML pipeline functions**
  - Zero test files exist in the repo — major gap for any senior reviewer
  - Add `pytest` tests covering: `detect_problem_type()`, `clean_data()`, `engineer_features()` edge cases, `_build_prediction_frame()`
  - Minimum 8–10 tests
  - Create: `backend/tests/test_pipeline.py`, `backend/tests/test_deployment.py`
  - Add `pytest` and `pytest-cov` to `requirements.txt`

- [ ] **#5 Add GitHub Actions CI pipeline** *(blocked by #4)*
  - Create `.github/workflows/ci.yml` — runs on every push and PR to `main`
  - Steps: checkout → Python 3.11 setup → `pip install` → `pytest` → `ruff`/`flake8` lint
  - Optional: frontend job with `npm install` + `npm run build`
  - Signals professional repo hygiene to recruiters viewing the GitHub page

- [ ] **#6 Add `/health` and `/ready` endpoints**
  - `GET /health` — liveness, always returns 200
  - `GET /ready` — readiness, checks DB connection + Redis ping, returns 503 if either is down
  - Required for Docker health checks, Kubernetes probes, Render health monitoring
  - File: `backend/app/main.py`

---

## Phase 3 — Storage & Observability

- [ ] **#7 Move model artifacts from PostgreSQL `LargeBinary` to S3-compatible storage**
  - `deployed_model.py:21` stores `model_blob` as binary in Postgres — bloats the DB
  - Wire up `backend/app/services/storage.py` to upload/download `.pkl` files to S3 / Cloudflare R2 / MinIO
  - Store only the object key in `model_path`, set `model_blob = None`
  - Update `_restore_model_file()` in `deployment.py` to download from S3 if file not on disk

- [ ] **#8 Add `PredictionLog` table and log every inference** *(blocked by #1)*
  - New SQLAlchemy model columns: `id`, `deployed_model_id`, `api_key_id`, `inputs` (JSON), `prediction`, `probability`, `latency_ms`, `created_at`
  - Log every call in both `predict()` and `public_predict()` in `deployment.py`
  - Foundation for drift detection (#15), Pandera validation (#16), and audit trails
  - Create an Alembic migration for the new table

- [ ] **#9 Integrate MLflow experiment tracking** *(blocked by #4, #5)*
  - Add `mlflow` to `requirements.txt`
  - In `tasks.py _run_training()`, wrap `run_agentic_pipeline()` with `mlflow.start_run()`
  - Log params: dataset size, target column, problem type
  - Log metrics: best model name, accuracy, F1, R²; log the `.pkl` as an artifact
  - In `agents.py model_selector_agent`, log per-model metrics for full leaderboard in MLflow UI
  - Add `MLFLOW_TRACKING_URI` to `.env` and `backend/app/core/config.py`

---

## Phase 4 — LangGraph Improvements
> These justify LangGraph over plain Python / Airflow. Do in order.

- [ ] **#10 Add retry loop for low-performing models**
  - In `graph.py`, add a conditional edge after `model_selector_agent`
  - If `best_primary_score < 0.60` → route back to `feature_engineer_agent` with `retry_count` and `use_aggressive_engineering=True` in `AgentState`
  - In `feature_engineer_agent`, check the flag and apply stricter outlier removal + more polynomial features on retry
  - Cap retries at 2 to prevent infinite loops
  - **This is the key LangGraph differentiator** — dynamic loops that Airflow's DAG model cannot replicate
  - Files: `backend/ml/graph.py`, `backend/ml/agents.py`, `backend/ml/agent_state.py`

- [ ] **#11 Replace rule-based plain-English explanation with LLM call** *(blocked by #10)*
  - `deployment.py:229` has `_generate_plain_english()` using hardcoded string templates
  - Replace with a Claude / OpenAI API call: pass model name, metrics, top 3 SHAP features+values, problem type, target column → return a 2-sentence business-language explanation
  - Makes the `langchain` import in `requirements.txt` legitimate
  - Directly visible to users on every prediction
  - Add `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` to `.env` and `config.py`

- [ ] **#12 Add LLM dataset analysis agent as first pipeline node** *(blocked by #11)*
  - Add `dataset_analyst_agent` node in `graph.py` — set as the new entry point before `data_cleaner_agent`
  - Agent reads: column names, dtypes, sample rows (first 5), missing value counts
  - Calls LLM with a structured prompt asking for: columns to drop, encoding hints, whether to use SMOTE, expected problem type
  - Stores recommendations in `AgentState` as `llm_strategy: dict`
  - Downstream agents read `llm_strategy` to adjust their behavior
  - **This is the feature that makes the pipeline genuinely agentic** — the LLM decides how to process each unique dataset
  - Files: `backend/ml/graph.py`, `backend/ml/agents.py`, `backend/ml/agent_state.py`

---

## Phase 5 — Model Operations & Monitoring

- [ ] **#13 Add model versioning and rollback** *(blocked by #7)*
  - Add columns to `DeployedModel`: `version` (Integer), `parent_id` (ForeignKey self), `is_champion` (Boolean)
  - When deploying a model for a job that already has a deployment, increment version instead of returning the existing one
  - Add `POST /deploy/models/{model_id}/rollback` — sets `is_champion=False` on current, `True` on previous version
  - Add Alembic migration
  - File: `backend/app/models/deployed_model.py`, `backend/app/api/routes/deployment.py`

- [ ] **#14 Add experiment comparison dashboard (frontend)**
  - New page `/experiments` — queries all jobs for the current user
  - Renders comparison table: dataset name, best model, accuracy/R², F1, training duration, date
  - Add bar chart comparing best scores across all jobs
  - Data already exists in `jobs.result` JSON — no new backend endpoints needed
  - Create: `frontend/src/pages/Experiments.tsx`
  - Wire into `frontend/src/App.tsx` and `frontend/src/components/Sidebar.tsx`

- [ ] **#15 Add input data drift detection** *(blocked by #8)*
  - Add a Celery beat scheduled task that runs daily per deployed model
  - Compare distribution of recent prediction inputs (last 7 days from `PredictionLog.inputs`) vs. training distribution stored in job result
  - Use PSI (Population Stability Index) per feature — flag if PSI > 0.2
  - Set a `drift_detected` boolean on `DeployedModel` and surface a warning badge on `/models` and `/apis` frontend pages

- [ ] **#16 Add Pandera schema validation on prediction inputs** *(blocked by #8)*
  - Add `pandera` to `requirements.txt`
  - In `agents.py data_cleaner_agent`, after cleaning infer + serialize a Pandera schema (`schema.to_yaml()`) and store in `AgentState` + job result
  - In `deployment.py _build_prediction_frame()`, load the schema and validate input DataFrame before prediction
  - Raise descriptive HTTP 400 if validation fails (wrong dtype, out-of-range value, unknown category)

---

## Phase 6 — GPU / Deep Learning Integration (Kaggle)

- [ ] **#18 Add Kaggle GPU kernel integration for DL model training**
  - Allow users to select a deep learning model type (TabNet, PyTorch MLP) on the upload page instead of the default sklearn AutoML path
  - **New UI:** Add a "Model Type" dropdown to `frontend/src/pages/Upload.tsx` — options: `Auto (sklearn)`, `TabNet`, `PyTorch MLP`; pass `dl_model_type` field in the upload request body
  - **`agent_state.py`:** Add 3 fields: `dl_model_type: Optional[str]`, `kaggle_kernel_slug: Optional[str]`, `kaggle_username: Optional[str]`
  - **`agents.py`:** Add `kaggle_trainer_agent(state)` — the agent:
    1. Exports `engineered_df` to a temp CSV
    2. Generates a `.ipynb` notebook from a template (TabNet via `pytorch-tabnet` or a PyTorch MLP training loop) that saves `model.pkl` + `metrics.json` as output files
    3. Pushes the kernel to Kaggle via `kaggle.api.kernel_push()` with `enable_gpu=True`
    4. Polls `kaggle.api.kernel_status()` every 30s until `"complete"` or `"error"` (max 60 polls = 30 min)
    5. Downloads output via `kaggle.api.kernel_output()` to `/app/models/kaggle_{slug}/`
    6. Writes `final_result` into `AgentState` using the **same keys** as `explainer_agent` (`model_path`, `features`, `best_metrics`, etc.) so the deployment and prediction endpoints need zero changes
  - **`graph.py`:** Add `should_use_gpu()` routing function after `feature_engineer` node:
    - `dl_model_type` is set → route to `kaggle_trainer` → `END`
    - `dl_model_type` is None → existing sklearn path (`model_selector` → `tuner` → `explainer`)
  - **`model_package` contract:** The notebook must pickle a dict with the same keys as the sklearn path: `{"model", "scaler", "features", "target", "problem_type", "model_name", "input_features"}` — this ensures `_restore_model_file()` and `public_predict()` in `deployment.py` work without modification
  - **Env vars:** Add `KAGGLE_USERNAME` and `KAGGLE_KEY` to `.env` and `backend/app/core/config.py`
  - **`requirements.txt`:** Add `kaggle`, `pytorch-tabnet`, `torch`
  - Files: `backend/ml/agent_state.py`, `backend/ml/agents.py`, `backend/ml/graph.py`, `frontend/src/pages/Upload.tsx`, `backend/app/core/config.py`

---

## Phase 7 — Polish & Resume

- [ ] **#17 Quantify README and write resume bullet points** *(blocked by #12, #14, #15)*
  - Update `README.MD` with:
    - Architecture diagram (Mermaid or image)
    - Numbered feature list with metrics: "trains and compares 8–10 ML algorithms per dataset", "up to 30 RandomizedSearchCV iterations", "SHAP explanations on every prediction"
    - Badges: CI passing, Python 3.11, live demo link
  - Write 3–4 resume bullets in PAR format (Problem → Action → Result) ready to paste into a CV

---

## Dependency Map

```
#1 ──────────────────────────────► #8 ──► #15
                                    └────► #16
#4 ──► #5 ──► #9
#7 ──────────────────────────────► #13
#10 ──► #11 ──► #12
#12, #14, #15 ───────────────────► #17
#10 ──────────────────────────────► #18 (feature_engineer output feeds Kaggle agent)
```

---

## Quick Reference by Category

| Category | Tasks |
|----------|-------|
| Bug fixes | #1, #2, #3 |
| CI/CD & Testing | #4, #5, #6 |
| Storage & Infra | #7, #8 |
| MLOps | #9, #15, #16 |
| LangGraph / Agentic | #10, #11, #12 |
| Model Operations | #13 |
| Frontend | #14 |
| GPU / Deep Learning | #18 |
| Resume / Docs | #17 |

| Priority | Tasks |
|----------|-------|
| Fix immediately (broken/insecure) | #1, #2, #3 |
| High (foundation for everything else) | #4, #5, #7, #8 |
| Medium (MLOps credibility) | #6, #9, #13, #14 |
| High (LangGraph justification) | #10, #11, #12 |
| Nice to have | #15, #16, #17 |
| Ambitious / GPU feature | #18 |
