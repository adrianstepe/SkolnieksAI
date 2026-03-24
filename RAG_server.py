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

from RAG import CHROMA_DIR, CONTENT_COLLECTION, SKOLA2030_COLLECTION, EMBEDDING_MODEL, get_chroma_client, _CHROMA_TENANT

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
_content_collection: Any = None   # skolnieks_content — always present
_skola_collection: Any = None     # skola2030_chunks  — optional


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    global _model, _content_collection, _skola_collection
    print(f"[startup] Loading embedding model: {EMBEDDING_MODEL}")
    _model = SentenceTransformer(EMBEDDING_MODEL)
    location = f"Chroma Cloud (tenant={_CHROMA_TENANT})" if _CHROMA_TENANT else CHROMA_DIR
    print(f"[startup] Connecting to ChromaDB: {location}")
    client = get_chroma_client()

    # Primary collection — always created if missing, safe to query even when empty
    _content_collection = client.get_or_create_collection(CONTENT_COLLECTION)
    print(f"[startup] '{CONTENT_COLLECTION}' has {_content_collection.count()} chunks.")

    # Optional Skola2030 collection — only attach if it exists
    try:
        _skola_collection = client.get_collection(SKOLA2030_COLLECTION)
        print(f"[startup] '{SKOLA2030_COLLECTION}' has {_skola_collection.count()} chunks.")
    except Exception:
        _skola_collection = None
        print(f"[startup] '{SKOLA2030_COLLECTION}' not found — Skola2030 content unavailable.")

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

def _query_collection(
    coll: Any,
    embedding: list[list[float]],
    top_k: int,
    where_clause: "dict[str, Any] | None",
) -> "tuple[list[Any], list[Any], list[Any]]":
    """Query a single ChromaDB collection; return (docs, metas, distances)."""
    results = coll.query(
        query_embeddings=embedding,
        n_results=min(top_k, coll.count()),
        where=where_clause,
        include=["documents", "metadatas", "distances"],
    )
    return (
        results["documents"][0],   # type: ignore[index]
        results["metadatas"][0],   # type: ignore[index]
        results["distances"][0],   # type: ignore[index]
    )


@app.post("/query", response_model=QueryResponse)
def query_endpoint(req: QueryRequest, _: None = Depends(require_api_key)) -> QueryResponse:
    assert _model is not None and _content_collection is not None, "Server not initialised"

    # Return empty gracefully if no content ingested yet
    content_count = _content_collection.count()
    skola_count = _skola_collection.count() if _skola_collection else 0
    if content_count == 0 and skola_count == 0:
        print("[query] All collections empty — run ingest first")
        return QueryResponse(chunks=[], sources=[], distances=[], metadatas=[])  # type: ignore[call-arg]

    embedding = _model.encode([req.question], show_progress_bar=False).tolist()

    where_clause: dict[str, Any] | None = None
    if req.where_subject:
        where_clause = {"subject": {"$eq": req.where_subject}}

    # Query both collections and merge results by distance (best first)
    combined: list[tuple[float, str, Any]] = []  # (distance, doc, meta)

    if content_count > 0:
        docs, metas, dists = _query_collection(_content_collection, embedding, req.top_k, where_clause)
        for doc, meta, dist in zip(docs, metas, dists):
            combined.append((float(dist), str(doc) if doc else "", meta))

    if _skola_collection and skola_count > 0:
        docs, metas, dists = _query_collection(_skola_collection, embedding, req.top_k, where_clause)
        for doc, meta, dist in zip(docs, metas, dists):
            combined.append((float(dist), str(doc) if doc else "", meta))

    # Sort merged results by distance, take top_k
    combined.sort(key=lambda x: x[0])
    combined = combined[: req.top_k]  # type: ignore[index]

    chunks:    list[str]       = []
    sources:   list[str]       = []
    distances: list[float]     = []
    metadatas: list[ChunkMeta] = []

    for dist, doc, meta in combined:
        chunks.append(doc)
        pdf     = str(meta.get("source_pdf", "unknown"))
        page    = meta.get("page_number")
        subject = str(meta.get("subject", ""))
        src_type = str(meta.get("source_type", ""))
        label   = f"{pdf} | {subject}"
        if src_type:
            label = f"[{src_type}] {label}"
        sources.append(label)
        distances.append(dist)
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
    content_count = _content_collection.count() if _content_collection is not None else -1
    skola_count = _skola_collection.count() if _skola_collection is not None else None
    return {
        "status": "ok",
        "collections": {
            CONTENT_COLLECTION: content_count,
            SKOLA2030_COLLECTION: skola_count,
        },
    }


@app.get("/audit")
def audit() -> dict[str, Any]:
    """Show what sources are indexed in ChromaDB across both collections."""
    result: dict[str, Any] = {}

    for label, coll in [
        (CONTENT_COLLECTION, _content_collection),
        (SKOLA2030_COLLECTION, _skola_collection),
    ]:
        if coll is None:
            result[label] = {"status": "not loaded"}
            continue
        total = coll.count()
        if total == 0:
            result[label] = {"status": "empty", "total_chunks": 0, "sources": []}
            continue
        sample = coll.get(limit=200, include=["metadatas"])
        metas: list[Any] = sample.get("metadatas") or []
        seen: dict[str, int] = {}
        for m in metas:
            pdf = str(m.get("source_pdf", "unknown"))
            seen[pdf] = seen.get(pdf, 0) + 1
        result[label] = {
            "total_chunks": total,
            "sampled": len(metas),
            "sources": [{"source_pdf": k, "chunks_in_sample": v} for k, v in sorted(seen.items())],
        }

    return result


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("rag_server:app", host="127.0.0.1", port=8001, reload=True)
