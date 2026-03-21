"""
SkolnieksAI RAG API server — port 8001
Run: uvicorn RAG_server:app --port 8001 --reload
"""

from contextlib import asynccontextmanager
from typing import Any

import chromadb
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

from RAG import CHROMA_DIR, COLLECTION, EMBEDDING_MODEL

# ---------------------------------------------------------------------------
# Shared state — loaded once at startup, reused across requests
# ---------------------------------------------------------------------------

_model: SentenceTransformer | None = None
_collection: Any = None  # chromadb.Collection


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    global _model, _collection
    print(f"[startup] Loading embedding model: {EMBEDDING_MODEL}")
    _model = SentenceTransformer(EMBEDDING_MODEL)
    print(f"[startup] Connecting to ChromaDB: {CHROMA_DIR}")
    client = chromadb.PersistentClient(path=CHROMA_DIR)
    _collection = client.get_collection(COLLECTION)
    print("[startup] Ready.")
    yield
    # Nothing to clean up


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="SkolnieksAI RAG API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    question: str
    top_k: int = Field(default=5, ge=1, le=20)


class QueryResponse(BaseModel):
    chunks: list[str]
    sources: list[str]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/query", response_model=QueryResponse)
def query_endpoint(req: QueryRequest) -> QueryResponse:
    assert _model is not None and _collection is not None, "Server not initialised"

    embedding = _model.encode([req.question], show_progress_bar=False).tolist()

    results = _collection.query(
        query_embeddings=embedding,
        n_results=req.top_k,
        include=["documents", "metadatas", "distances"],
    )

    docs  = results["documents"][0]
    metas = results["metadatas"][0]

    chunks:  list[str] = []
    sources: list[str] = []

    for doc, meta in zip(docs, metas):
        chunks.append(doc)
        pdf  = meta.get("source_pdf", "unknown")
        page = meta.get("page_number")
        sources.append(f"{pdf}#p{page}" if page is not None else pdf)

    return QueryResponse(chunks=chunks, sources=sources)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("RAG_server:app", host="127.0.0.1", port=8001, reload=True)
