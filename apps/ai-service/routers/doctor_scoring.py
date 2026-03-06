from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class DoctorScoreRequest(BaseModel):
    referral_count_30d: int = 0
    referral_count_90d: int = 0
    total_revenue: float = 0
    days_since_last_visit: Optional[int] = None
    days_since_last_referral: Optional[int] = None
    has_email: bool = False
    specialty_tier: int = 2


class BulkDoctorScoreRequest(BaseModel):
    doctors: list[DoctorScoreRequest]


@router.post("/score")
async def score_doctor(request: Request, body: DoctorScoreRequest):
    scorer = request.app.state.doctor_influencer
    return scorer.score(**body.model_dump())


@router.post("/score/bulk")
async def score_doctors_bulk(request: Request, body: BulkDoctorScoreRequest):
    scorer = request.app.state.doctor_influencer
    return {"scores": [scorer.score(**d.model_dump()) for d in body.doctors]}
