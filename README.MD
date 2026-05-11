# AutoLab

An AutoML platform for training, explaining, deploying, and sharing machine-learning models from tabular datasets.

Upload a dataset, let the backend train and compare models, inspect the results, then deploy the best model as a REST API.

---

## Live Links

- Frontend: https://ml-foundry.vercel.app
- Backend API: https://mlfoundry-1.onrender.com
- API docs: https://mlfoundry-1.onrender.com/docs


---

## Features

- Authentication with JWT access and refresh tokens
- Multi-format upload: CSV, Excel, JSON, Parquet, and TSV
- Dataset caching with force retrain support
- Automatic classification/regression detection
- Agentic ML pipeline using LangGraph
- Model comparison across multiple algorithms
- Hyperparameter tuning
- SHAP-based explanations and plain-English prediction explanations
- Classification confusion matrix on results page
- One-click deployment as a REST prediction API
- OHE-aware prediction tester for newly trained models
- API key hashing for new keys
- Basic per-key rate limiting for public prediction APIs
- Marketplace with model descriptions and per-user API key generation
- Render/Vercel deployment-ready setup

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.11 |
| Database | PostgreSQL |
| Cache / Queue | Redis |
| Background Jobs | Celery |
| ML Engine | scikit-learn, XGBoost, LightGBM, SHAP |
| Agent Workflow | LangGraph, LangChain |
| Payments | Razorpay |
| Deployment | Docker, Render, Vercel |

---

## Local Development

### Prerequisites

- Docker Desktop
- Node.js 18+
- Git

### Start backend, database, Redis, and Celery

```bash
docker-compose up --build
```

Backend runs at:

```text
http://localhost:8000
```

API docs run at:

```text
http://localhost:8000/docs
```

### Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:

```text
http://localhost:5173
```

---

## Environment Variables

Create `backend/.env`:

```env
DATABASE_URL=postgresql://omniml_user:omniml_pass@db:5432/omniml_db
REDIS_URL=redis://redis:6379/0
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
```

For Vercel frontend, set:

```env
VITE_API_URL=https://ml-foundry.onrender.com
```

Use your actual Render backend URL if it differs.

---

## API Usage

After deploying a model, the app creates an API key. New keys are shown once, then stored hashed.

Prediction endpoint:

```text
POST /deploy/v1/predict?api_key=YOUR_API_KEY
```

Example:

```bash
curl -X POST "http://localhost:8000/deploy/v1/predict?api_key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"data":{"age":30,"city":"Delhi","income":50000}}'
```

Marketplace users should click `Use API` on a marketplace model to generate their own key for that model.

---

## Notes

- Render free instances have ephemeral local disk, so the app stores uploaded dataset bytes and trained model artifacts in PostgreSQL as a fallback.
- Older datasets/models created before artifact persistence may still require re-upload/retrain.
- Raw API keys cannot be recovered after creation because new keys are hashed.
- Public prediction is rate-limited per API key.