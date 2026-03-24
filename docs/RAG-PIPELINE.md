# RAG Pipeline — SkolnieksAI

## Overview

The RAG (Retrieval-Augmented Generation) pipeline is the core differentiator. It grounds AI responses in open educational resources like OpenStax and Wikipedia (LV).

## Phase 1: Ingestion (`scripts/ingest.ts`)

### Source Documents
- OpenStax PDFs (translated or retrieved cross-lingually) and Wikipedia (LV).
- Store raw PDFs in `data/openstax/`, etc. (git-ignored)
- *Future: Integrate Skola2030 framework PDFs and VISC exams once licensing is acquired.*

### Pipeline Steps

```
PDF → pdfplumber (extract text + tables) → clean text → chunk → embed → ChromaDB
```

1. **Extract**: Use `pdfplumber` (Python) or a TypeScript PDF lib to pull text per page. Preserve table structures where possible.
2. **Clean**: Remove headers/footers, page numbers, excessive whitespace. Keep section headings.
3. **Chunk**: Split into ~500 token chunks with ~50 token overlap. Respect paragraph/section boundaries — never split mid-sentence.
4. **Metadata**: Attach to each chunk: `{ source_pdf, subject, grade_min, grade_max, page_number, section_title }`
5. **Embed**: Generate 384-dim embeddings using `paraphrase-multilingual-MiniLM-L12-v2` via sentence-transformers
6. **Store**: Upsert into ChromaDB collection `knowledge_chunks`

### Chunking Strategy

```typescript
const CHUNK_CONFIG = {
  targetTokens: 500,
  overlapTokens: 50,
  minChunkTokens: 100,  // discard fragments smaller than this
  separators: ['\n\n', '\n', '. ', ' '],  // split priority order
};
```

### Subject Classification

Map PDFs to subjects based on filename/content:
- `matematika_*.pdf` → subject: "math"
- `latviesu_valoda_*.pdf` → subject: "latvian"
- `anglu_valoda_*.pdf` → subject: "english"
- `dabaszinibas_*.pdf` → subject: "science"
- `vesture_*.pdf` → subject: "history"
- `socialas_zinibas_*.pdf` → subject: "social_studies"

Grade ranges extracted from document metadata or filename patterns.

## Phase 2: Retrieval (`lib/rag/retriever.ts`)

### Query Flow

```typescript
async function retrieve(query: string, filters?: { subject?: string; grade?: number }) {
  // 1. Embed the query
  const queryEmbedding = await embedQuery(query);

  // 2. Build ChromaDB where filter
  const where: Record<string, unknown> = {};
  if (filters?.subject) where.subject = filters.subject;
  if (filters?.grade) {
    where.grade_min = { $lte: filters.grade };
    where.grade_max = { $gte: filters.grade };
  }

  // 3. Query ChromaDB
  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: 5,
    where: Object.keys(where).length > 0 ? where : undefined,
  });

  return results.documents[0].map((doc, i) => ({
    content: doc,
    metadata: results.metadatas[0][i],
    distance: results.distances[0][i],
  }));
}
```

### Relevance Threshold

Discard results with cosine distance > 0.8 — they're noise, not signal. Better to answer "I don't have specific curriculum info on that" than to hallucinate from irrelevant chunks.

## Phase 3: Prompt Construction (`lib/rag/chain.ts`)

### System Prompt Template

```
Tu esi SkolnieksAI — Latvijas mācību palīgs. Skolēns mācās {grade}. klasē.

Noteikumi:
- Sazinies un skaidro tādā līmenī, kas ir atbilstošs {grade}. klases skolēnam Latvijā. Neveido pārāk sarežģītas atbildes.
- Atbildi TIKAI latviešu valodā
- Balsties uz zemāk norādīto zināšanu bāzi
- Ja informācija nav pieejama dotajos materiālos, saki to godīgi
- Norādi atsauces uz konkrētām tēmām vai eksāmenu uzdevumiem
- Tu palīdzi SAPRAST, nevis dari mājas darbus skolēna vietā

Zināšanu materiāls:
{retrieved_chunks}
```

### Message Construction

```typescript
const messages = [
  { role: 'system', content: systemPrompt },
  ...conversationHistory.slice(-6), // keep last 3 exchanges for context
  { role: 'user', content: userMessage },
];
```

Limit conversation history to last 6 messages (3 exchanges) to control token usage.

## Evaluation (`scripts/eval-rag.ts`)

### Test Set Structure

```json
{
  "question": "Kas ir fotosintēze?",
  "subject": "science",
  "grade": 7,
  "expectedTopics": ["gaisma", "hlorofils", "glikoze", "CO2"],
  "expectedSourcePdf": "dabaszinibas_7_8.pdf"
}
```

### Metrics
- **Retrieval Recall**: % of expected source docs in top-5 results
- **Topic Coverage**: % of expected topics mentioned in response
- **Language Check**: Response is in Latvian (detect with simple heuristic)
- **Hallucination Check**: No claims that contradict retrieved chunks

Run with `npm run eval-rag`. Target: >80% retrieval recall, >70% topic coverage before launch.

## Future Improvements

- Latvian-specific embedding model (if one emerges with good quality)
- Hybrid search (BM25 + dense vectors) via ChromaDB's built-in support
- Reranking step with a cross-encoder
- User feedback loop: thumbs up/down to fine-tune retrieval weights
