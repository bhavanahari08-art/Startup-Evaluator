"""
TrustEval - FastAPI Backend Entry Point
Explainable AI & Bias-Aware Decision Support System
"""
import os
import sys

# Load .env file if present (before anything else)
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("[TrustEval] Loaded .env file")
except ImportError:
    # python-dotenv not installed — load .env manually
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    v = v.strip()
                    if v and not os.environ.get(k.strip()):
                        os.environ[k.strip()] = v
        print("[TrustEval] Loaded .env manually")

# Ensure the project root is in path so services can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from backend.db.database import create_tables
from backend.routers import auth, evaluate, explainability, bias, reports, research, startup
from backend.routers import config as config_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle events."""
    # Create DB tables
    create_tables()

    # Train models if not already present
    dataset_path = "datasets/synthetic_startups.csv"
    model_path = "models/biased_rf_model.pkl"
    if not os.path.exists(dataset_path) or not os.path.exists(model_path):
        print("[TrustEval] Training baseline model on synthetic data...")
        from backend.services.model_trainer import train_and_save_models
        train_and_save_models()
        print("[TrustEval] Model training complete.")
    else:
        print("[TrustEval] Model artifacts already exist. Skipping training.")

    yield
    print("[TrustEval] Shutting down.")


app = FastAPI(
    title="TrustEval API",
    description="Explainable AI & Bias-Aware Startup Feasibility Assessment System",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS - allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(auth.router,           prefix="/api/auth",     tags=["Authentication"])
app.include_router(evaluate.router,       prefix="/api/evaluate", tags=["Evaluation"])
app.include_router(explainability.router, prefix="/api/explain",  tags=["Explainability"])
app.include_router(bias.router,           prefix="/api/bias",     tags=["Bias & Fairness"])
app.include_router(reports.router,        prefix="/api/reports",  tags=["Reports"])
app.include_router(research.router,       prefix="/api/research", tags=["Research Chat"])
app.include_router(startup.router,        prefix="/api/startup",  tags=["Startup Analyzer"])
app.include_router(config_router.router,  prefix="/api/config",   tags=["Configuration"])


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "TrustEval API v2.0"}
