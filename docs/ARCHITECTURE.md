# Architecture — SkolnieksAI

## System Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Student    │────▶│  Next.js on      │────▶│  Firebase Auth   │
│   Browser    │◀────│  Vercel (Edge)   │◀────│  + Firestore     │
└─────────────┘     └───────┬──────────┘     └─────────────────┘
                            │
                    ┌───────▼──────────┐
                    │   /api/chat       │
                    │   (RAG endpoint)  │
                    └───────┬──────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
      ┌──────────┐  ┌────────────┐  ┌──────────┐
      │ ChromaDB │  │ DeepSeek   │  │ Claude   │
      │ (vectors)│  │ V3.2 (free)│  │ Sonnet   │
      └──────────┘  └────────────┘  │ (paid)   │
                                    └──────────┘
```

## Chat Request Flow

1. Student types question → `POST /api/chat` with `{ message, conversationId, subject?, grade? }`
2. Middleware verifies Firebase Auth token → reject if invalid
3. Usage gate: read `users/{uid}/usage/{YYYY-MM}` → check token budget remaining
4. RAG retrieval:
   - Embed query with sentence-transformers (same model as ingest)
   - Query ChromaDB top-k=5 chunks, filtered by subject + grade metadata
   - Future: rerank step for quality
5. Build prompt: system message (Latvian, Skola2030, grade) + retrieved chunks + user message
6. Route to LLM: free → DeepSeek V3.2, paid → Claude Sonnet 4.6
7. Stream response via Vercel AI SDK (SSE)
8. Post-response: log tokens to Firestore usage doc, append to conversation

## Firestore Data Model

```
users/{uid}
  ├── email, displayName, tier (free|premium|exam_prep|school_pro)
  ├── grade (6-12), school?, createdAt
  ├── stripeCustomerId?, stripeSubscriptionId?
  ├── referralCode, referredBy?
  └── usage/{YYYY-MM}
        ├── inputTokens, outputTokens, queryCount
        └── lastQueryAt

conversations/{conversationId}
  ├── userId, subject, grade, createdAt, updatedAt
  └── messages/{messageId}
        ├── role (user|assistant), content
        ├── tokens { input, output }
        └── createdAt
```

## Token Budget System

Free tier uses a hidden budget, not a visible query counter:
- ~150,000 tokens/month (input + output combined) ≈ 60 questions
- When exhausted: show upgrade prompt (not error)
- Track per `users/{uid}/usage/{YYYY-MM}` document
- Resets on 1st of month (compare `lastQueryAt`)

## LLM Client Design

Both clients share one interface:
```typescript
interface LLMClient {
  chat(params: {
    systemPrompt: string;
    messages: Message[];
    maxTokens: number;
    stream: boolean;
  }): AsyncIterable<string>;
}
```

`lib/ai/router.ts` picks client by user tier. DeepSeek uses OpenAI-compatible SDK. Claude uses Anthropic SDK.

## ChromaDB Collection

Collection: `skola2030_chunks`

Document shape:
- `id`: hash of (pdf_filename + page + chunk_index)
- `document`: text chunk (~500 tokens)
- `embedding`: 384-dim (all-MiniLM-L6-v2 or Latvian-tuned)
- `metadata`: `{ source_pdf, subject, grade_min, grade_max, page_number, section_title }`

## Deployment Targets

| Service     | Host               | Cost        |
|-------------|--------------------|-----------  |
| Frontend+API| Vercel (free tier) | €0/mo       |
| ChromaDB    | Hetzner VPS        | ~€5/mo      |
| Firebase    | Spark → Blaze      | €0 → usage  |
| Stripe      | Standard           | 1.4% + €0.25|

## Security Checklist

- [ ] Firebase Auth tokens verified server-side on every request
- [ ] Stripe webhook signature validation (never skip)
- [ ] Rate limit `/api/chat`: 10 req/min (free), 30 req/min (paid)
- [ ] Input sanitization: strip HTML, max 2000 chars
- [ ] No PII in ChromaDB — curriculum content only
- [ ] Firestore rules: users read/write own docs only
- [ ] CORS: restrict to production domain + localhost
