# Test RAG

Run the RAG evaluation suite and report results.

## Instructions

1. Verify ChromaDB is running: `curl http://localhost:8000/api/v1/heartbeat`
2. Verify `skola2030_chunks` collection has documents
3. Run `npm run eval-rag`
4. Report: Question | Subject | Grade | Retrieval Recall | Topic Coverage | Language OK
5. If recall <80%: check PDF ingestion, chunk metadata, suggest re-ingest
6. If response not in Latvian: check system prompt in `lib/rag/chain.ts`

## Quick Smoke Test

```bash
npx tsx scripts/eval-rag.ts --quick
```

## Common Issues

- ChromaDB down → `docker compose up chroma -d`
- Empty collection → `npm run ingest` first
- Low recall → reduce chunk size to 400 tokens
- Wrong language → system prompt missing Latvian instruction
