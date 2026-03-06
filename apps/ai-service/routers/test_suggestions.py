from fastapi import APIRouter, Request, Query
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class SuggestionRequest(BaseModel):
    query: str
    top_k: Optional[int] = 8


@router.get("/tests")
async def suggest_tests(
    request: Request,
    q: str = Query(..., description="Symptom, condition, or test name"),
    top_k: int = Query(8, ge=1, le=20),
):
    """
    Given a symptom or condition query, return ranked test suggestions.
    Used in order entry and patient booking flows.
    """
    mapper = request.app.state.symptom_mapper
    return mapper.suggest(q, top_k=top_k)


@router.post("/tests")
async def suggest_tests_post(request: Request, body: SuggestionRequest):
    mapper = request.app.state.symptom_mapper
    return mapper.suggest(body.query, top_k=body.top_k or 8)
