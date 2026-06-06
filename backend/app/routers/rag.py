"""RAG search over the German bureaucracy knowledge corpus (auth-required)."""

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models import User
from app.rag import store
from app.schemas import RagHit, RagQuery, RagResponse

router = APIRouter(prefix="/api/rag", tags=["rag"])


@router.post("/search", response_model=RagResponse)
def search(payload: RagQuery, _: User = Depends(get_current_user)):
    where = {"institution": payload.institution} if payload.institution else None
    hits = store.search(payload.query, top_k=payload.top_k, where=where)
    return RagResponse(hits=[RagHit(**h) for h in hits])


@router.post("/reseed")
def reseed(_: User = Depends(get_current_user)):
    from app.rag.seed import seed_corpus

    coll = store.get_collection()
    seed_corpus(coll)
    return {"seeded": coll.count()}
