"""Klar — FastAPI entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.rag.store import init_chroma
from app.routers import actions, letters, rag


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    init_chroma()
    yield


app = FastAPI(
    title="Klar API",
    description="German bureaucratic mail → structured obligations + deadlines.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(letters.router)
app.include_router(actions.router)
app.include_router(rag.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "klar", "model": settings.llm_model}
