"""
SkolnieksAI RAG API server — port 8001
Run: uvicorn rag_server:app --port 8001 --reload
"""

import os
from contextlib import asynccontextmanager
from typing import Any

import chromadb
import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

from RAG import CHROMA_DIR, COLLECTION, EMBEDDING_MODEL

# ---------------------------------------------------------------------------
# API key authentication
# ---------------------------------------------------------------------------

_RAG_API_KEY = os.environ.get("RAG_API_KEY", "")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_api_key(key: str | None = Security(_api_key_header)) -> None:
    if not _RAG_API_KEY:
        raise RuntimeError("RAG_API_KEY env var is not set — refusing all requests")
    if key != _RAG_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")

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
    # get_or_create so the server starts cleanly even before first ingest
    _collection = client.get_or_create_collection(COLLECTION)
    count = _collection.count()
    print(f"[startup] Ready — collection '{COLLECTION}' has {count} chunks.")
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
    question: str = Field(..., max_length=2000)
    top_k: int = Field(default=3, ge=1, le=10)
    where_subject: str | None = None  # optional subject filter (e.g. "physics")


class ChunkMeta(BaseModel):
    source_pdf: str
    subject: str
    grade_min: int
    grade_max: int
    page_number: int
    chunk_index: int


class QueryResponse(BaseModel):
    chunks: list[str]
    sources: list[str]
    distances: list[float]  # ChromaDB cosine distances 0–2; lower = more relevant
    metadatas: list[ChunkMeta]


class EmbedRequest(BaseModel):
    text: str = Field(..., max_length=2000)


class EmbedResponse(BaseModel):
    embedding: list[float]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/query", response_model=QueryResponse)
def query_endpoint(req: QueryRequest, _: None = Depends(require_api_key)) -> QueryResponse:
    assert _model is not None and _collection is not None, "Server not initialised"

    # Return empty gracefully if collection has no data yet
    if _collection.count() == 0:
        print("[query] Collection is empty — run ingest first")
        return QueryResponse(chunks=[], sources=[], distances=[], metadatas=[])  # type: ignore[call-arg]

    embedding = _model.encode([req.question], show_progress_bar=False).tolist()

    # Apply subject filter when provided (skips filter for None/"general"/"unknown")
    where_clause: dict[str, Any] | None = None
    if req.where_subject:
        where_clause = {"subject": {"$eq": req.where_subject}}

    results = _collection.query(
        query_embeddings=embedding,
        n_results=req.top_k,
        where=where_clause,
        include=["documents", "metadatas", "distances"],
    )

    docs:      list[Any] = results["documents"][0]   # type: ignore[index]
    metas:     list[Any] = results["metadatas"][0]   # type: ignore[index]
    raw_dists: list[Any] = results["distances"][0]   # type: ignore[index]

    chunks:    list[str]       = []
    sources:   list[str]       = []
    distances: list[float]     = []
    metadatas: list[ChunkMeta] = []

    for doc, meta, dist in zip(docs, metas, raw_dists):
        chunks.append(str(doc) if doc else "")
        pdf     = str(meta.get("source_pdf", "unknown"))
        page    = meta.get("page_number")
        subject = str(meta.get("subject", ""))
        label   = f"{pdf} | {subject} | lpp. {page}" if page is not None else f"{pdf} | {subject}"
        sources.append(label)
        distances.append(float(dist))
        metadatas.append(ChunkMeta(
            source_pdf  = pdf,
            subject     = subject,
            grade_min   = int(meta.get("grade_min", 1)),
            grade_max   = int(meta.get("grade_max", 12)),
            page_number = int(page) if page is not None else 0,
            chunk_index = int(meta.get("chunk_index", 0)),
        ))

    q_preview    = req.question[:60]  # type: ignore[index]
    dist_preview = [round(d, 3) for d in distances]  # type: ignore[call-overload]
    subject_tag  = f"  subject_filter={req.where_subject!r}" if req.where_subject else ""
    print(f"[query] q={q_preview!r}  returned={len(chunks)}  distances={dist_preview}{subject_tag}")

    return QueryResponse(chunks=chunks, sources=sources, distances=distances, metadatas=metadatas)  # type: ignore[call-arg]


@app.post("/embed", response_model=EmbedResponse)
def embed_endpoint(req: EmbedRequest, _: None = Depends(require_api_key)) -> EmbedResponse:
    assert _model is not None, "Server not initialised"
    embedding = _model.encode([req.text], show_progress_bar=False).tolist()[0]
    return EmbedResponse(embedding=embedding)


@app.get("/health")
def health() -> dict[str, Any]:
    count = _collection.count() if _collection is not None else -1
    return {"status": "ok", "collection": COLLECTION, "chunk_count": count}


@app.get("/audit")
def audit() -> dict[str, Any]:
    """
    Show what source PDFs are indexed in ChromaDB.
    Use this to verify exam-spec documents were actually ingested before
    trusting the AI to answer curriculum questions about them.
    """
    if _collection is None:
        return {"error": "collection not loaded"}
    total = _collection.count()
    if total == 0:
        return {"count": 0, "sources": [], "note": "Collection is empty — run ingest first"}

    sample = _collection.get(limit=200, include=["metadatas"])
    metas: list[Any] = sample.get("metadatas") or []
    seen: dict[str, int] = {}
    for m in metas:
        pdf = str(m.get("source_pdf", "unknown"))
        seen[pdf] = seen.get(pdf, 0) + 1

    return {
        "total_chunks": total,
        "sampled": len(metas),
        "sources": [{"source_pdf": k, "chunks_in_sample": v} for k, v in sorted(seen.items())],
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("rag_server:app", host="127.0.0.1", port=8001, reload=True)
