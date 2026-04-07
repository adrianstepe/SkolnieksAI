"""
scripts/migrate_to_cloud.py — one-off migration: local ChromaDB → Chroma Cloud.

Migrates only the 'skolnieks_content' collection (OpenStax + Wikipedia LV).
skola2030_chunks is intentionally excluded — no license yet.

Usage:
  # From project root, with venv active:
  skolnieksai-env\\Scripts\\activate
  python scripts/migrate_to_cloud.py
"""

import os
import sys

# Allow imports from repo root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env.local"))

import chromadb

from RAG import CONTENT_COLLECTION
from rag.chroma_client import CHROMA_DIR

BATCH_SIZE = 100


def main() -> None:
    api_key  = os.environ.get("CHROMA_API_KEY", "")
    tenant   = os.environ.get("CHROMA_TENANT", "")
    database = os.environ.get("CHROMA_DATABASE", "skolnieksai")

    if not api_key or not tenant:
        print("ERROR: CHROMA_API_KEY and CHROMA_TENANT must be set (check .env.local)")
        sys.exit(1)

    print("=" * 60)
    print("SkolnieksAI — migrate skolnieks_content to Chroma Cloud")
    print("=" * 60)
    print(f"Source : local PersistentClient at {CHROMA_DIR}")
    print(f"Target : Chroma Cloud (tenant={tenant}, database={database})")
    print(f"Note   : skola2030_chunks excluded (no license)")
    print()

    # Source: local DB
    local_client = chromadb.PersistentClient(path=CHROMA_DIR)
    try:
        local_coll = local_client.get_collection(CONTENT_COLLECTION)
    except Exception:
        print(f"ERROR: Collection '{CONTENT_COLLECTION}' not found in local DB.")
        print("Run ingest_openstax.py and ingest_wikipedia_lv.py first.")
        sys.exit(1)

    total = local_coll.count()
    print(f"Local '{CONTENT_COLLECTION}': {total} chunks to migrate")

    if total == 0:
        print("Nothing to migrate — run ingest scripts first.")
        sys.exit(0)

    # Target: Chroma Cloud
    cloud_client = chromadb.CloudClient(
        api_key=api_key,
        tenant=tenant,
        database=database,
    )
    cloud_coll = cloud_client.get_or_create_collection(CONTENT_COLLECTION)
    before = cloud_coll.count()
    print(f"Cloud  '{CONTENT_COLLECTION}': {before} chunks already present")
    print()

    # Paginate local DB and upsert to cloud in batches
    uploaded = 0
    offset = 0
    while offset < total:
        batch = local_coll.get(
            limit=BATCH_SIZE,
            offset=offset,
            include=["embeddings", "documents", "metadatas"],
        )
        ids        = batch["ids"]
        embeddings = batch["embeddings"]
        documents  = batch["documents"]
        metadatas  = batch["metadatas"]

        if not ids:
            break

        cloud_coll.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )

        uploaded += len(ids)
        offset   += BATCH_SIZE
        print(f"  Uploaded {uploaded}/{total} chunks...", end="\r", flush=True)

    print()  # newline after \r progress

    after = cloud_coll.count()
    print()
    print("=" * 60)
    print("Migration complete")
    print(f"  Chunks uploaded this run : {uploaded}")
    print(f"  Cloud collection total   : {after}")
    print("=" * 60)


if __name__ == "__main__":
    main()
