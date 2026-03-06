from fastapi import APIRouter
from datetime import datetime

router = APIRouter()


@router.get("")
async def health():
    return {
        "status": "ok",
        "service": "DELViON AI Service",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "models": ["symptom_mapper", "lead_scorer", "tat_predictor", "doctor_influencer"],
    }
