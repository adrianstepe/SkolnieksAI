"""
rag/chroma_client.py — shared ChromaDB client factory.

Rules:
  - CHROMA_API_KEY set in env  →  Chroma Cloud (CloudClient)
  - CHROMA_API_KEY not set     →  local PersistentClient at SkolnieksAI_DB

All Python files that need a ChromaDB client import get_chroma_client() from here.
Never instantiate chromadb directly outside this module.
"""

import os

import chromadb

# Root of the repo (one level above this file's rag/ package)
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Path to local persistent store — used when CHROMA_API_KEY is not set
CHROMA_DIR = os.path.join(_REPO_ROOT, "SkolnieksAI_DB")

# Cloud credentials — all read from environment, never hardcoded
_API_KEY  = os.environ.get("CHROMA_API_KEY", "")
_TENANT   = os.environ.get("CHROMA_TENANT", "")
_DATABASE = os.environ.get("CHROMA_DATABASE", "skolnieksai")


def get_chroma_client() -> chromadb.ClientAPI:
    """
    Return a ChromaDB client.

    Cloud mode (CHROMA_API_KEY is set):
        Uses chromadb.CloudClient — connects to api.trychroma.com
        with tenant/database from CHROMA_TENANT / CHROMA_DATABASE.

    Local mode (CHROMA_API_KEY not set):
        Uses chromadb.PersistentClient at CHROMA_DIR (SkolnieksAI_DB/).
        Works out of the box for local development with no env vars needed.
    """
    if _API_KEY:
        return chromadb.CloudClient(
            api_key=_API_KEY,
            tenant=_TENANT,
            database=_DATABASE,
        )
    return chromadb.PersistentClient(path=CHROMA_DIR)
