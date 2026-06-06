"""RAG search over the German bureaucracy knowledge corpus."""

from fastapi import APIRouter

from app.rag import store
from app.schemas import RagHit, RagQuery, RagResponse

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post("/search", response_model=RagResponse)
def search(payload: RagQuery):
    where = {"institution": payload.institution} if payload.institution else None
    hits = store.search(payload.query, top_k=payload.top_k, where=where)
    return RagResponse(hits=[RagHit(**h) for h in hits])


@router.post("/reseed")
def reseed():
    from app.rag.seed import seed_corpus

    coll = store.get_collection()
    seed_corpus(coll)
    return {"seeded": coll.count()}
