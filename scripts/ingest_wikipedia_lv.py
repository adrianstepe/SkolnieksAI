"""
ingest_wikipedia_lv.py — Fetch Latvian Wikipedia articles by category and ingest into skolnieks_content.

License: CC BY-SA 4.0 — free to use with attribution.
Run from project root: python scripts/ingest_wikipedia_lv.py [--reset] [--category Fizika]
"""

import hashlib
import os
import sys
import time

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Wikipedia's API requires a descriptive User-Agent — requests without one get 403'd
_SESSION = requests.Session()
_SESSION.headers.update({
    "User-Agent": "SkolnieksAI/1.0 (educational tool; https://github.com/skolnieksai) python-requests"
})

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    print("Missing deps. Run: pip install sentence-transformers requests")
    sys.exit(1)

from RAG import CONTENT_COLLECTION, EMBEDDING_MODEL, get_chroma_client

# ---------------------------------------------------------------------------
# Category catalogue — Latvian Wikipedia categories aligned to Skola2030 subjects
# ---------------------------------------------------------------------------

CATEGORIES: list[dict] = [
    {"category": "Fizika",              "subject_id": "physics"},
    {"category": "Kvantu_fizika",       "subject_id": "physics"},
    {"category": "Termodinamika",       "subject_id": "physics"},
    {"category": "Elektromagnētisms",   "subject_id": "physics"},
    {"category": "Ķīmija",             "subject_id": "chemistry"},
    {"category": "Organiskie_savienojumi", "subject_id": "chemistry"},
    {"category": "Bioloģija",           "subject_id": "biology"},
    {"category": "Botānika",            "subject_id": "biology"},
    {"category": "Zooloģija",           "subject_id": "biology"},
    {"category": "Matemātika",          "subject_id": "math"},
    {"category": "Ģeometrija",          "subject_id": "math"},
    {"category": "Algebras_teorija",    "subject_id": "math"},
    {"category": "Ģeogrāfija",         "subject_id": "geography"},
    {"category": "Latvijas_ģeogrāfija", "subject_id": "geography"},
    {"category": "Vēsture",             "subject_id": "history"},
    {"category": "Latvijas_vēsture",    "subject_id": "history"},
    {"category": "Astronomija",         "subject_id": "astronomy"},
]

WIKIPEDIA_LV_API = "https://lv.wikipedia.org/w/api.php"
MAX_PAGES_PER_CATEGORY = 40
CHUNK_SIZE = 600   # words
CHUNK_OVERLAP = 100  # words
MIN_CHUNK = 100    # words
REQUEST_DELAY = 0.3  # seconds between API calls (be polite)


def get_category_pages(category: str, limit: int = MAX_PAGES_PER_CATEGORY) -> list[str]:
    """Return list of page titles in a Wikipedia category."""
    params = {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": f"Kategorija:{category}",
        "cmlimit": limit,
        "cmtype": "page",
        "format": "json",
    }
    try:
        r = _SESSION.get(WIKIPEDIA_LV_API, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        return [p["title"] for p in data.get("query", {}).get("categorymembers", [])]
    except Exception as e:
        print(f"    WARNING: Could not fetch category '{category}': {e}")
        return []


def get_article_text(title: str) -> str:
    """Fetch plain text of a Wikipedia article."""
    params = {
        "action": "query",
        "titles": title,
        "prop": "extracts",
        "explaintext": True,
        "exsectionformat": "plain",
        "format": "json",
    }
    try:
        r = _SESSION.get(WIKIPEDIA_LV_API, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        pages = data.get("query", {}).get("pages", {})
        page = next(iter(pages.values()))
        return page.get("extract", "")
    except Exception as e:
        print(f"    WARNING: Could not fetch article '{title}': {e}")
        return ""


def chunk_text(text: str) -> list[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        end = min(i + CHUNK_SIZE, len(words))
        chunk = " ".join(words[i:end])
        if len(chunk.split()) >= MIN_CHUNK:
            chunks.append(chunk)
        i += max(CHUNK_SIZE - CHUNK_OVERLAP, 1)
    return chunks


def make_id(title: str, idx: int) -> str:
    return hashlib.md5(f"lv_wikipedia_{title}_chunk_{idx}".encode()).hexdigest()


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Ingest Latvian Wikipedia into skolnieks_content")
    parser.add_argument("--reset", action="store_true", help="Delete existing Wikipedia chunks before ingesting")
    parser.add_argument("--category", help="Only ingest this category (e.g. Fizika)")
    parser.add_argument("--max-pages", type=int, default=MAX_PAGES_PER_CATEGORY)
    args = parser.parse_args()

    print("=" * 60)
    print("SkolnieksAI -- Latvian Wikipedia ingestion")
    print("=" * 60)

    client = get_chroma_client()
    collection = client.get_or_create_collection(CONTENT_COLLECTION)
    print(f"Collection '{CONTENT_COLLECTION}' -- {collection.count()} chunks before ingestion")

    print(f"Loading embedding model: {EMBEDDING_MODEL}")
    model = SentenceTransformer(EMBEDDING_MODEL)
    print("  Model ready.")

    categories = CATEGORIES
    if args.category:
        categories = [c for c in CATEGORIES if c["category"].lower() == args.category.lower()]
        if not categories:
            categories = [{"category": args.category, "subject_id": "general"}]
            print(f"Category not in catalogue, using subject_id='general'")

    total_articles = 0
    total_chunks = 0
    seen_titles: set[str] = set()  # deduplicate across categories

    for cat_entry in categories:
        category = cat_entry["category"]
        subject_id = cat_entry["subject_id"]

        print(f"\n[{category}] subject={subject_id}")
        titles = get_category_pages(category, limit=args.max_pages)
        print(f"  {len(titles)} pages found")

        for title in titles:
            if title in seen_titles:
                continue
            seen_titles.add(title)

            time.sleep(REQUEST_DELAY)
            text = get_article_text(title)
            if len(text.split()) < MIN_CHUNK:
                continue  # skip stubs

            chunks = chunk_text(text)
            if not chunks:
                continue

            embeddings = model.encode(chunks, show_progress_bar=False, batch_size=32).tolist()

            ids = [make_id(title, i) for i in range(len(chunks))]
            metas = [
                {
                    "source_pdf": f"wikipedia_lv_{title.replace(' ', '_')}.txt",
                    "source_type": "wikipedia_lv",
                    "source_title": title,
                    "subject": subject_id,
                    "subject_id": subject_id,
                    "grade_min": 1,
                    "grade_max": 12,
                    "page_number": 0,
                    "chunk_index": i,
                    "license": "CC BY-SA 4.0",
                    "language": "lv",
                    "attribution": f"Wikipedia contributors, '{title}', lv.wikipedia.org, CC BY-SA 4.0",
                }
                for i in range(len(chunks))
            ]

            collection.upsert(
                ids=ids,
                embeddings=embeddings,
                documents=chunks,
                metadatas=metas,
            )

            total_articles += 1
            total_chunks += len(chunks)

        print(f"  Done — {total_articles} articles, {total_chunks} chunks so far")

    print("\n" + "=" * 60)
    print(f"Wikipedia LV ingestion complete")
    print(f"  Articles ingested : {total_articles}")
    print(f"  Chunks stored     : {total_chunks}")
    print(f"  Collection '{CONTENT_COLLECTION}' now has {collection.count()} chunks total")
    print("=" * 60)


if __name__ == "__main__":
    main()
