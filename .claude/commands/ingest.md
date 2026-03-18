# Ingest PDFs

Parse Skola2030 curriculum PDFs into ChromaDB.

## Instructions

1. Verify PDFs exist in `data/skola2030/` — list them
2. Verify ChromaDB is running: `curl http://localhost:8000/api/v1/heartbeat`
3. Run `npm run ingest`
4. After ingestion, verify:
   - Collection `skola2030_chunks` exists
   - Document count matches expectations (~100-500 chunks per PDF)
   - Metadata fields present: `source_pdf`, `subject`, `grade_min`, `grade_max`
5. Run quick RAG test: `/test-rag` with `--quick` flag

## CRITICAL

- **ONLY** ingest Skola2030 framework PDFs
- **NEVER** ingest VISC exam papers — legal clearance pending
- Check `docs/RAG-PIPELINE.md` for chunking config and subject mapping

## Troubleshooting

- PDF text garbled → check encoding, try different extraction lib
- Too few chunks → PDF might be image-based, needs OCR
- Metadata wrong → check filename-to-subject mapping in `scripts/ingest.ts`
