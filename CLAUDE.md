# SkolnieksAI

Latvia's first AI study companion. Aligns to the national curriculum via RAG over open educational resources like OpenStax and Wikipedia (LV). Target: 110–120k students grades 6–12 across 553 schools.

**Founder**: Adrians, 18, solo dev. **Company**: Stepe Digital (pre-SIA). **Budget**: ~€60 baseline.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router) + Tailwind CSS → Vercel
- **Auth**: Firebase Auth (email + Google). Firestore for user profiles & usage tracking
- **Vector DB**: Chroma Cloud (`skolnieks_content` collection). Embeddings: `@xenova/transformers` (Node.js, no Python). Production queries Chroma Cloud directly via `lib/rag/retriever.ts`.
- **RAG**: pdfplumber for PDF ingestion → ChromaDB retrieval → LLM. Production retrieval is pure TypeScript (no Python server needed). `RAG_server.py` is legacy/local-dev only.
- **Free tier AI**: DeepSeek V3.2 (`deepseek-chat`). $0.028/1M cached, $0.28 miss, $0.42 output
- **Paid tier AI**: Claude Sonnet 4.6 only (via Anthropic API)
- **Payments**: Stripe Checkout + webhooks
- **Mobile** (post-MVP): Flutter
- **Dev tools**: Claude Code + AntiGravity IDE + GitHub

## Commands

```bash
npm run dev          # Next.js dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint + Prettier check
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright e2e tests
npm run ingest       # Parse PDFs (OpenStax etc.) → ChromaDB (scripts/ingest.ts)
npm run seed         # Seed test data into Firestore
```

## Architecture

```
src/
├── app/                  # Next.js App Router
│   ├── (auth)/           # Login, signup pages
│   ├── (dashboard)/      # Protected student dashboard
│   ├── api/
│   │   ├── chat/         # RAG chat endpoint (POST)
│   │   ├── webhooks/     # Stripe webhook handler
│   │   └── health/       # Health check
│   └── layout.tsx        # Root layout (Latvian locale)
├── components/
│   ├── ui/               # Reusable primitives (Button, Input, Card)
│   └── chat/             # Chat interface components
├── lib/
│   ├── rag/              # RAG pipeline (retriever, chain, prompts)
│   ├── ai/               # LLM client wrappers (DeepSeek, Claude)
│   ├── firebase/         # Firebase Admin + client SDK
│   ├── stripe/           # Stripe client + webhook verification
│   └── utils/            # Shared helpers
├── scripts/
│   ├── ingest.ts         # PDF → chunks → embeddings → ChromaDB
│   └── seed.ts           # Firestore test data seeder
└── data/
    ├── openstax/         # OpenStax PDFs
    └── skola2030/        # (Future) Official framework PDFs
```

## API Routes

- **POST /api/chat**: Main chat endpoint. When `conversationId` is present and client sends fewer than 2 history messages (page-refresh edge case), the server fetches the last 6 messages from Firestore (`conversations/{id}/messages`, ordered by `createdAt` desc, limit 6) using the Admin SDK with a 2-second timeout, then passes them to `runRagChainStream`. If the fetch fails, continues with empty history (degraded gracefully, never 500s).

## Web Search Query Translation

`fetchWebContext` in `lib/rag/chain.ts` detects non-Latvian queries (heuristic: no Latvian diacritics + presence of common English function words like "what/is/the/how") and translates them to Latvian via a tiny DeepSeek call **before** calling `webSearch`. Falls back to appending `latviski` if the translation call fails. Reason: Tavily/Wikipedia LV return ~0 results for raw English queries, which previously dropped users into Path C. The original query is still passed to the LLM unchanged — the system prompt's "always respond in Latvian" rule keeps the answer in Latvian regardless of input language.

## ChromaDB

- **Production (Vercel)**: `lib/rag/retriever.ts` connects to Chroma Cloud via `chromadb` npm `CloudClient`. Requires env vars: `CHROMA_API_KEY`, `CHROMA_TENANT`, `CHROMA_DATABASE`. Embeddings via `@xenova/transformers` in Node.js — no Python server needed.
- **Local dev / ingestion**: Python scripts (`RAG_server.py`, `rag/chroma_client.py`) still work for local ingestion. `rag/chroma_client.py::get_chroma_client()` handles local vs cloud routing for Python tools.
- Only `skolnieks_content` is on Chroma Cloud. `skola2030_chunks` excluded — no license yet.

## Critical Rules

1. **NEVER** commit `.env`, `.env.local`, or any file with API keys
2. **Current MVP**: Use OpenStax and Wikipedia. Skola2030 and VISC exams are currently un-licensed; keep structure ready for future integration.
3. **All UI text in Latvian** by default. English only in code/comments
4. **Token budget**: Free tier = hidden token budget (~60q/month), NOT a flat query counter. Track in Firestore `users/{uid}/usage/{YYYY-MM}`
5. **GDPR**: Latvia consent age = 13. Under-13 needs parental consent. EU data residency
6. **Stripe webhooks** must validate signatures. Never trust client-side payment state
7. **Positioning**: "AI that helps you understand" — NEVER "AI that does homework"
8. **DeepSeek system prompt** must include: Skola2030 context, grade level, subject, Latvian language, curriculum citations

## Code Style

- TypeScript strict. No `any` — use `unknown` + type guards
- Named exports. Default exports only for Next.js pages/layouts
- Tailwind only — no custom CSS files
- Server Components by default. `'use client'` only when state/effects needed
- API routes validate input with Zod
- Error boundaries on every route segment
- Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`

## Testing

- Unit: Vitest (colocated `.test.ts`)
- E2E: Playwright (`tests/`)
- RAG eval: `scripts/eval-rag.ts`
- Rule: test every API route + RAG chain before shipping

## Key Docs

- `docs/ARCHITECTURE.md` — system design, data models, request flow
- `docs/RAG-PIPELINE.md` — ingestion, chunking, retrieval, prompt templates
- `docs/MVP-PLAN.md` — phased build order with acceptance criteria
- `docs/MVP-ROADMAP.md` — detailed task checklist per phase
- `docs/API-DESIGN.md` — all API routes, request/response formats
- `docs/API-COSTS.md` — token budgets and unit economics
- `docs/ENV-VARS.md` — all environment variables
- `docs/LEGAL-GDPR.md` — GDPR compliance, age consent, user rights
- `docs/LEGAL.md` — content licensing, VISC restrictions, company registration
- `docs/DEPLOYMENT.md` — Vercel, Firebase, ChromaDB deploy guides

## Compaction

When compacting, preserve: file tree, critical rules, current MVP phase, and any failing test context.
