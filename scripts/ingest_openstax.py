"""
ingest_openstax.py — Download OpenStax textbooks and ingest into skolnieks_content.

License: CC BY 4.0 — free to use with attribution.
Run from project root: python scripts/ingest_openstax.py [--reset]
"""

import hashlib
import os
import sys
import tempfile

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pdfplumber
    from sentence_transformers import SentenceTransformer
except ImportError:
    print("Missing deps. Run: pip install pdfplumber sentence-transformers requests")
    sys.exit(1)

from RAG import CONTENT_COLLECTION, EMBEDDING_MODEL, get_chroma_client

# ---------------------------------------------------------------------------
# Book catalogue — CC BY 4.0 OpenStax books relevant to Latvian curriculum
# ---------------------------------------------------------------------------

OPENSTAX_BOOKS = [
    {
        "id": "physics_hs",
        "title": "OpenStax Physics",
        "url": "https://assets.openstax.org/oscms-prodcms/media/documents/Physics-WEB_7Zesafu.pdf",
        "subject_id": "physics",
        "language": "en",
    },
    {
        "id": "chemistry_2e",
        "title": "OpenStax Chemistry 2e",
        "url": "https://assets.openstax.org/oscms-prodcms/media/documents/Chemistry2e-WEB_6Zesafu.pdf",
        "subject_id": "chemistry",
        "language": "en",
    },
    {
        "id": "biology_2e",
        "title": "OpenStax Biology 2e",
        "url": "https://assets.openstax.org/oscms-prodcms/media/documents/Biology2e-WEB.pdf",
        "subject_id": "biology",
        "language": "en",
    },
    {
        "id": "prealgebra_2e",
        "title": "OpenStax Prealgebra 2e",
        "url": "https://assets.openstax.org/oscms-prodcms/media/documents/Prealgebra2e-WEB.pdf",
        "subject_id": "math",
        "language": "en",
    },
    {
        "id": "algebra_trig_2e",
        "title": "OpenStax Algebra and Trigonometry 2e",
        "url": "https://assets.openstax.org/oscms-prodcms/media/documents/AlgebraAndTrigonometry2e-WEB.pdf",
        "subject_id": "math",
        "language": "en",
    },
]

CHUNK_SIZE = 800   # words
CHUNK_OVERLAP = 200  # words
MIN_CHUNK = 150    # words


def download_pdf(url: str, dest: str) -> None:
    print(f"  Downloading {url.split('/')[-1]}...")
    headers = {"User-Agent": "SkolnieksAI/1.0 (educational tool) python-requests"}
    r = requests.get(url, timeout=120, stream=True, headers=headers)
    r.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in r.iter_content(chunk_size=65536):
            f.write(chunk)


def extract_text_from_pdf(path: str) -> str:
    text_parts = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            raw = page.extract_text()
            if raw:
                text_parts.append(raw)
    return "\n".join(text_parts)


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        end = min(i + chunk_size, len(words))
        chunk = " ".join(words[i:end])
        if len(chunk.split()) >= MIN_CHUNK:
            chunks.append(chunk)
        advance = chunk_size - overlap
        i += max(advance, 1)
    return chunks


def make_id(book_id: str, idx: int) -> str:
    return hashlib.md5(f"{book_id}_chunk_{idx}".encode()).hexdigest()


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Ingest OpenStax PDFs into skolnieks_content")
    parser.add_argument("--reset", action="store_true", help="Delete existing OpenStax chunks before ingesting")
    parser.add_argument("--book", help="Only ingest this book ID (e.g. physics_hs)")
    args = parser.parse_args()

    print("=" * 60)
    print("SkolnieksAI -- OpenStax ingestion")
    print("=" * 60)

    client = get_chroma_client()
    collection = client.get_or_create_collection(CONTENT_COLLECTION)
    print(f"Collection '{CONTENT_COLLECTION}' — {collection.count()} chunks before ingestion")

    print(f"Loading embedding model: {EMBEDDING_MODEL}")
    model = SentenceTransformer(EMBEDDING_MODEL)
    print("  Model ready.")

    books = OPENSTAX_BOOKS
    if args.book:
        books = [b for b in OPENSTAX_BOOKS if b["id"] == args.book]
        if not books:
            print(f"Unknown book ID: {args.book}")
            print(f"Valid IDs: {[b['id'] for b in OPENSTAX_BOOKS]}")
            sys.exit(1)

    total_chunks = 0

    # User can place pre-downloaded PDFs here to skip the CDN download
    LOCAL_PDF_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "openstax")

    with tempfile.TemporaryDirectory() as tmpdir:
        for book in books:
            print(f"\n[{book['id']}] {book['title']}")

            # Prefer a locally placed PDF (data/openstax/{book_id}.pdf) over downloading
            local_pdf = os.path.join(LOCAL_PDF_DIR, f"{book['id']}.pdf")
            if os.path.isfile(local_pdf):
                print(f"  Using local file: {local_pdf}")
                pdf_path = local_pdf
            else:
                pdf_path = os.path.join(tmpdir, f"{book['id']}.pdf")
                try:
                    download_pdf(book["url"], pdf_path)
                except Exception as e:
                    print(f"  ERROR downloading: {e}")
                    print(f"  TIP: Download the PDF from openstax.org and save it to:")
                    print(f"       {local_pdf}")
                    continue

            print("  Extracting text...")
            try:
                text = extract_text_from_pdf(pdf_path)
            except Exception as e:
                print(f"  ERROR extracting: {e}")
                continue

            chunks = chunk_text(text)
            print(f"  {len(text.split())} words -> {len(chunks)} chunks")

            if not chunks:
                print("  No chunks produced, skipping.")
                continue

            print(f"  Embedding {len(chunks)} chunks...", end="", flush=True)
            embeddings = model.encode(chunks, show_progress_bar=False, batch_size=32).tolist()
            print(" done")

            ids = [make_id(book["id"], i) for i in range(len(chunks))]
            metas = [
                {
                    "source_pdf": f"{book['id']}.pdf",
                    "source_type": "openstax",
                    "source_title": book["title"],
                    "subject": book["subject_id"],
                    "subject_id": book["subject_id"],
                    "grade_min": 7,
                    "grade_max": 12,
                    "page_number": 0,
                    "chunk_index": i,
                    "license": "CC BY 4.0",
                    "language": book["language"],
                    "attribution": f"{book['title']}, OpenStax, CC BY 4.0, openstax.org",
                }
                for i in range(len(chunks))
            ]

            # Upsert in batches of 100
            batch_size = 100
            for start in range(0, len(chunks), batch_size):
                end = start + batch_size
                collection.upsert(
                    ids=ids[start:end],
                    embeddings=embeddings[start:end],
                    documents=chunks[start:end],
                    metadatas=metas[start:end],
                )

            total_chunks += len(chunks)
            print(f"  Stored {len(chunks)} chunks OK")

    print("\n" + "=" * 60)
    print(f"OpenStax ingestion complete — {total_chunks} chunks added")
    print(f"Collection '{CONTENT_COLLECTION}' now has {collection.count()} chunks total")
    print("=" * 60)


if __name__ == "__main__":
    main()
