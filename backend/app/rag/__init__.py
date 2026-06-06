"""RAG (Retrieval-Augmented Generation) layer.

Public surface:
    - store    — ChromaDB persistent client helpers (get_collection, search, upsert)
    - seed_corpus(collection) — populate from the hand-curated SEED_DOCS
"""

from app.rag import store
from app.rag.seed import SEED_DOCS, seed_corpus

__all__ = ["store", "seed_corpus", "SEED_DOCS"]
