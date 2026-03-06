from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter()


class TATRequest(BaseModel):
    test_turnaround_hours: List[int]
    priority: str = "ROUTINE"
    collection_time: Optional[str] = None
    pending_orders_count: int = 0


@router.post("/predict")
async def predict_tat(request: Request, body: TATRequest):
    predictor = request.app.state.tat_predictor
    collection_time = None
    if body.collection_time:
        try:
            collection_time = datetime.fromisoformat(body.collection_time.replace("Z", "+00:00"))
        except Exception:
            collection_time = datetime.utcnow()

    return predictor.predict(
        test_turnaround_hours=body.test_turnaround_hours,
        priority=body.priority,
        collection_time=collection_time,
        pending_orders_count=body.pending_orders_count,
    )
