from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

load_dotenv()

from routers import health_check, test_suggestions, lead_scoring, tat_prediction, doctor_scoring


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("DELViON AI Service starting...")
    from models.symptom_test_map import SymptomTestMapper
    from models.lead_scorer import LeadScorer
    from models.tat_predictor import TATPredictor
    from models.doctor_influencer import DoctorInfluencer

    app.state.symptom_mapper = SymptomTestMapper()
    app.state.lead_scorer = LeadScorer()
    app.state.tat_predictor = TATPredictor()
    app.state.doctor_influencer = DoctorInfluencer()
    print("All models loaded. AI Service ready.")
    yield
    print("AI Service shutting down.")


app = FastAPI(
    title="DELViON Health AI Service",
    description="ML models and AI features for DELViON Health Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("ALLOWED_ORIGINS", "http://localhost:3001")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_check.router, prefix="/health", tags=["Health"])
app.include_router(test_suggestions.router, prefix="/suggest", tags=["Test Suggestions"])
app.include_router(lead_scoring.router, prefix="/leads", tags=["Lead Scoring"])
app.include_router(tat_prediction.router, prefix="/tat", tags=["TAT Prediction"])
app.include_router(doctor_scoring.router, prefix="/doctors", tags=["Doctor Scoring"])
