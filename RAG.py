import os
import re
import hashlib
import pdfplumber
import chromadb
from sentence_transformers import SentenceTransformer

# ---------------------------------------------------------------------------
# CONFIG — paths are relative to this script, no hardcoded machine paths
# ---------------------------------------------------------------------------
SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
BASE_DIR      = os.path.join(SCRIPT_DIR, "Skola2030")
CHROMA_DIR    = os.path.join(SCRIPT_DIR, "SkolnieksAI_DB")
COLLECTION    = "skola2030_chunks"          # matches ARCHITECTURE.md

# Chroma Cloud env vars — if CHROMA_TENANT is set, cloud mode is active
_CHROMA_TENANT   = os.environ.get("CHROMA_TENANT", "")
_CHROMA_DATABASE = os.environ.get("CHROMA_DATABASE", "skolnieksai")
_CHROMA_API_KEY  = os.environ.get("CHROMA_API_KEY", "")


def get_chroma_client() -> chromadb.ClientAPI:
    """Return a Chroma Cloud HttpClient if CHROMA_TENANT is set, else local PersistentClient."""
    if _CHROMA_TENANT:
        return chromadb.HttpClient(
            ssl=True,
            host="api.trychroma.com",
            tenant=_CHROMA_TENANT,
            database=_CHROMA_DATABASE,
            headers={"x-chroma-token": _CHROMA_API_KEY},
        )
    return chromadb.PersistentClient(path=CHROMA_DIR)
# Multilingual model — handles Latvian + English in the same vector space.
# Switched from all-MiniLM-L6-v2 (English-primary) to support Wikipedia LV + OpenStax.
EMBEDDING_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"

# Collections:
#   skolnieks_content  — open-license content (OpenStax + Wikipedia LV). Always present.
#   skola2030_chunks   — Skola2030 PDFs. Optional — legal clearance pending.
CONTENT_COLLECTION  = "skolnieks_content"
SKOLA2030_COLLECTION = "skola2030_chunks"
COLLECTION          = CONTENT_COLLECTION   # default collection for backwards-compat imports

CHUNK_SIZE    = 500   # words
CHUNK_OVERLAP = 50    # words
MIN_CHUNK     = 100   # words — discard tiny tail fragments

# ---------------------------------------------------------------------------
# Subject classification — ordered longest-match first to avoid prefix clashes
# ---------------------------------------------------------------------------
SUBJECT_MAP = [
    ("latviesu-valoda-un-literatura",  "latvian_literature"),
    ("mazakumtautibas-krievu-valod",   "minority_russian"),
    ("latvijas-un-pasaules-vesture",   "history"),
    ("socialas-zinibas-un-vesture",    "social_history"),
    ("socialas-zinatnes",              "social_sciences"),
    ("socialas-zinibas",               "social_studies"),
    ("dizains-un-tehnologijas",        "design_tech"),
    ("sports-un-veseliba",             "sports"),
    ("kultura-un-maksla",              "arts"),
    ("kulturas-pamati",                "culture"),
    ("latviesu-valoda",                "latvian"),
    ("krievu-valoda",                  "russian"),
    ("anglu-valoda",                   "english"),
    ("francu-valoda",                  "french"),
    ("vacu-valoda",                    "german"),
    ("literatura",                     "literature"),
    ("matematika",                     "math"),
    ("biologija",                      "biology"),
    ("geografija",                     "geography"),
    ("dabaszinibas",                   "science"),
    ("fizika",                         "physics"),
    ("kimija",                         "chemistry"),
    ("vesture",                        "history"),
    ("programmesana",                  "programming"),
    ("datorika",                       "cs"),
    ("inzenierzinibas",                "engineering"),
    ("vizuala-maksla",                 "visual_arts"),
    ("teatra-maksla",                  "theater"),
    ("muzika",                         "music"),
]


def classify_subject(filename: str) -> str:
    name = filename.lower().replace("_", "-")
    for keyword, subject in SUBJECT_MAP:
        if keyword in name:
            return subject
    return "unknown"


def get_grade_range(path: str) -> tuple[int, int]:
    if "10-12kl" in path:
        return 10, 12
    if "1-9kl" in path:
        return 1, 9
    return 1, 12


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def clean_text(text: str) -> str:
    """Strip page numbers, normalise whitespace."""
    # Remove standalone digit lines (page numbers)
    text = re.sub(r"(?m)^\s*\d+\s*$", "", text)
    # Collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Collapse spaces/tabs
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def extract_pages(pdf_path: str) -> list[tuple[int, str]]:
    """Return [(page_number, cleaned_text), ...] skipping blank pages."""
    pages = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                raw = page.extract_text()
                if raw:
                    cleaned = clean_text(raw)
                    if cleaned:
                        pages.append((i + 1, cleaned))
    except Exception as e:
        print(f"  ERROR reading {pdf_path}: {e}")
    return pages


def chunk_pages(
    pages: list[tuple[int, str]],
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
    min_chunk: int = MIN_CHUNK,
) -> list[tuple[int, str]]:
    """
    Chunk the document word-by-word while preserving start page number.
    Returns [(start_page, chunk_text), ...].
    """
    # Two parallel lists — avoids slice typing issues with list[tuple[...]]
    words: list[str] = []
    page_nums: list[int] = []
    for page_num, text in pages:
        for word in text.split():
            words.append(word)
            page_nums.append(page_num)

    if not words:
        return []

    chunks = []  # list of (start_page: int, chunk_text: str)
    total = len(words)
    i = 0
    while i < total:
        end = min(i + chunk_size, total)
        if end - i >= min_chunk:
            chunk_parts = []
            for j in range(i, end):
                chunk_parts.append(words[j])
            chunk_text = " ".join(chunk_parts)
            start_page = page_nums[i]
            chunks.append((start_page, chunk_text))
        advance = chunk_size - overlap
        if advance <= 0:
            advance = 1
        i += advance

    return chunks


def make_chunk_id(source_pdf: str, page_num: int, chunk_idx: int) -> str:
    key = f"{source_pdf}_p{page_num}_c{chunk_idx}"
    return hashlib.md5(key.encode()).hexdigest()


def collect_unique_pdfs(base_dir: str) -> list[str]:
    """
    Walk base_dir, return one path per unique filename.
    Skips saites.pdf (external-links-only file, no curriculum content).
    When the same filename appears in multiple folders (duplicates), keeps
    the first one encountered — category folders sort before deep duplicates.
    """
    seen: set[str] = set()
    unique: list[str] = []
    for root, _dirs, files in os.walk(base_dir):
        for file in sorted(files):
            if not file.endswith(".pdf"):
                continue
            if file == "saites.pdf":
                continue
            if file in seen:
                continue
            seen.add(file)
            unique.append(os.path.join(root, file))
    return unique


# ---------------------------------------------------------------------------
# Main ingestion
# ---------------------------------------------------------------------------

def ingest_pdf_list(
    pdf_paths: list[str],
    collection: "chromadb.Collection",  # type: ignore[name-defined]
    model: "SentenceTransformer",  # type: ignore[name-defined]
    source_tag: str = "skola2030",
) -> dict[str, int]:
    """Ingest a list of PDFs into a ChromaDB collection. Returns stats dict."""
    stats: dict[str, int] = {"pdfs": 0, "chunks": 0, "skipped": 0}

    for pdf_path in pdf_paths:
        filename  = os.path.basename(pdf_path)
        grade_min, grade_max = get_grade_range(pdf_path)
        subject   = classify_subject(filename)

        print(f"\n  {filename}")
        print(f"    grades {grade_min}-{grade_max} | subject: {subject}")

        pages = extract_pages(pdf_path)
        if not pages:
            print("    No text extracted -- skipping.")
            stats["skipped"] += 1
            continue

        chunks = chunk_pages(pages)
        if not chunks:
            print("    No chunks produced -- skipping.")
            stats["skipped"] += 1
            continue

        print(f"    {len(pages)} pages -> {len(chunks)} chunks", end="", flush=True)

        texts = [text for _, text in chunks]
        embeddings = model.encode(texts, show_progress_bar=False).tolist()

        ids: list[str] = []
        docs: list[str] = []
        metas: list[dict] = []
        embeds: list[list[float]] = []
        for idx, ((page_num, text), embedding) in enumerate(zip(chunks, embeddings)):
            ids.append(make_chunk_id(filename, page_num, idx))
            docs.append(text)
            metas.append({
                "source_pdf":  filename,
                "source_type": source_tag,
                "subject":     subject,
                "grade_min":   grade_min,
                "grade_max":   grade_max,
                "page_number": page_num,
                "chunk_index": idx,
                "license":     "Skola2030",
                "language":    "lv",
            })
            embeds.append(embedding)

        collection.upsert(ids=ids, embeddings=embeds, documents=docs, metadatas=metas)
        stats["chunks"] += len(chunks)
        stats["pdfs"] += 1
        print(" OK")

    return stats


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="SkolnieksAI -- RAG ingestion pipeline")
    parser.add_argument(
        "--skola2030", action="store_true",
        help="Ingest Skola2030 PDFs from ./Skola2030/ into skola2030_chunks (optional, legal clearance pending)",
    )
    parser.add_argument(
        "--reset-skola2030", action="store_true",
        help="Delete and recreate the skola2030_chunks collection before ingesting",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("SkolnieksAI -- RAG ingestion pipeline")
    print("=" * 60)

    location = f"Chroma Cloud (tenant={_CHROMA_TENANT})" if _CHROMA_TENANT else CHROMA_DIR
    print(f"\nOpening ChromaDB: {location}")
    client = get_chroma_client()

    print(f"Loading embedding model: {EMBEDDING_MODEL}")
    model = SentenceTransformer(EMBEDDING_MODEL)
    print("  Model ready.")

    if args.skola2030:
        print(f"\n[Skola2030] Scanning PDFs in: {BASE_DIR}")
        pdf_paths = collect_unique_pdfs(BASE_DIR)
        if not pdf_paths:
            print(f"  No PDFs found in {BASE_DIR} -- place Skola2030 PDFs there first.")
            return

        print(f"  Found {len(pdf_paths)} unique PDFs")

        if args.reset_skola2030:
            try:
                client.delete_collection(SKOLA2030_COLLECTION)
                print(f"  Deleted old collection: '{SKOLA2030_COLLECTION}'")
            except Exception:
                pass

        skola_coll = client.get_or_create_collection(SKOLA2030_COLLECTION)
        print(f"  Collection: '{SKOLA2030_COLLECTION}' (existing chunks: {skola_coll.count()})")

        print("\nIngesting Skola2030 PDFs...")
        stats = ingest_pdf_list(pdf_paths, skola_coll, model, source_tag="skola2030")

        print("\n" + "=" * 60)
        print("Ingestion complete")
        print(f"   PDFs processed : {stats['pdfs']}")
        print(f"   PDFs skipped   : {stats['skipped']}")
        print(f"   Chunks stored  : {stats['chunks']}")
        print(f"   Collection     : '{SKOLA2030_COLLECTION}'")
        print("=" * 60)
    else:
        print("\nNo source flag provided.")
        print("Usage:")
        print("  python RAG.py --skola2030                        # ingest Skola2030 PDFs")
        print("  python RAG.py --skola2030 --reset-skola2030      # reset then ingest")
        print("  python scripts/ingest_openstax.py                # ingest OpenStax books")
        print("  python scripts/ingest_wikipedia_lv.py            # ingest Latvian Wikipedia")


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------

def query(question: str, top_k: int = 5) -> list[dict]:
    """
    Embed `question` and retrieve the top_k most similar chunks from ChromaDB.
    Returns a list of dicts with keys: text, source_pdf, page_number, subject,
    grade_min, grade_max, chunk_index, distance.
    """
    client = get_chroma_client()
    collection = client.get_collection(COLLECTION)

    model = SentenceTransformer(EMBEDDING_MODEL)
    embedding = model.encode([question], show_progress_bar=False).tolist()

    results = collection.query(
        query_embeddings=embedding,
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )

    chunks = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        chunks.append({
            "text":        doc,
            "source_pdf":  meta.get("source_pdf", "unknown"),
            "page_number": meta.get("page_number"),
            "subject":     meta.get("subject", "unknown"),
            "grade_min":   meta.get("grade_min"),
            "grade_max":   meta.get("grade_max"),
            "chunk_index": meta.get("chunk_index"),
            "distance":    dist,
        })
    return chunks


if __name__ == "__main__":
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    argv: list[str] = list(sys.argv)
    if len(argv) > 1:
        question = " ".join(argv[i] for i in range(1, len(argv)))
        print(f"\nQuery: {question}")
        print("=" * 60)
        hits = query(question)
        for i, chunk in enumerate(hits, 1):
            print(f"\n[{i}] {chunk['source_pdf']}  page {chunk['page_number']}  "
                  f"subject={chunk['subject']}  grades={chunk['grade_min']}–{chunk['grade_max']}  "
                  f"distance={chunk['distance']:.4f}")
            print("-" * 60)
            print(chunk["text"][:400] + ("..." if len(chunk["text"]) > 400 else ""))
    else:
        main()
