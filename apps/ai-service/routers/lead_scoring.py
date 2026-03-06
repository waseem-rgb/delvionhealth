from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter()


class LeadScoreRequest(BaseModel):
    source: str
    note_count: int = 0
    created_at: str
    last_activity_at: Optional[str] = None
    expected_value: Optional[float] = None
    has_email: bool = False
    has_organization: bool = False
    status: str = "NEW"


class BulkLeadScoreRequest(BaseModel):
    leads: list[LeadScoreRequest]


def _score_one(scorer, lead: LeadScoreRequest) -> dict:
    created = datetime.fromisoformat(lead.created_at.replace("Z", "+00:00"))
    last_activity = (
        datetime.fromisoformat(lead.last_activity_at.replace("Z", "+00:00"))
        if lead.last_activity_at
        else created
    )
    now = datetime.utcnow().replace(tzinfo=created.tzinfo)
    return scorer.score(
        source=lead.source,
        note_count=lead.note_count,
        days_since_created=max((now - created).days, 0),
        days_since_last_activity=max((now - last_activity).days, 0),
        expected_value=lead.expected_value,
        has_email=lead.has_email,
        has_organization=lead.has_organization,
        status=lead.status,
    )


@router.post("/score")
async def score_lead(request: Request, body: LeadScoreRequest):
    return _score_one(request.app.state.lead_scorer, body)


@router.post("/score/bulk")
async def score_leads_bulk(request: Request, body: BulkLeadScoreRequest):
    scorer = request.app.state.lead_scorer
    return {"scores": [_score_one(scorer, lead) for lead in body.leads]}
