"""RAG search over the German bureaucracy knowledge corpus (auth-required)."""

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models import User
from app.rag import store
from app.schemas import ErrorResponse, RagHit, RagQuery, RagResponse

router = APIRouter(prefix="/api/rag", tags=["rag"])


@router.post(
    "/search",
    response_model=RagResponse,
    summary="Search the German bureaucracy knowledge corpus",
    description=(
        "Returns the top-k vector-similarity matches from the seed corpus "
        "(institutions, phrase patterns, deadline conventions). Internal "
        "debug surface — not part of the production frontend's main flow."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated."},
    },
)
def search(payload: RagQuery, _: User = Depends(get_current_user)):
    where = {"institution": payload.institution} if payload.institution else None
    hits = store.search(payload.query, top_k=payload.top_k, where=where)
    return RagResponse(hits=[RagHit(**h) for h in hits])


@router.post(
    "/reseed",
    summary="Reload the seed corpus into ChromaDB",
    description="Upserts every entry from `app/rag/seed.py::SEED_DOCS`.",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated."},
    },
)
def reseed(_: User = Depends(get_current_user)):
    from app.rag.seed import seed_corpus

    coll = store.get_collection()
    seed_corpus(coll)
    return {"seeded": coll.count()}
