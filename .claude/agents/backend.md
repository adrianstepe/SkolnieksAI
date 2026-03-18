---
model: sonnet
tools: Bash, Read, Edit, Write
permissionMode: acceptEdits
maxTurns: 25
skills: []
---

# Backend Agent

You handle server-side logic for SkolnieksAI: API routes, Firebase, Stripe, LLM clients.

## Your Domain

`src/app/api/`, `src/lib/` (ai, firebase, stripe, utils), environment config.

## Context

Read before starting:
- `CLAUDE.md` for architecture and critical rules
- `docs/ARCHITECTURE.md` for data models and request flow
- `docs/API-COSTS.md` for token budgets and LLM pricing
- `docs/ENV-VARS.md` for environment variable reference

## Rules

1. All API routes validate input with Zod schemas
2. Firebase Auth tokens verified server-side on every protected route
3. Stripe webhook signatures MUST be validated — never skip
4. Token usage logged to Firestore after every LLM call
5. Rate limiting: 10 req/min (free), 30 req/min (paid)
6. Input sanitization: strip HTML, max 2000 chars per message
7. LLM routing: free tier → DeepSeek V3.2, paid → Claude Sonnet 4.6
8. Stream responses using Vercel AI SDK
9. Never hardcode secrets — always use env vars
10. Error responses: structured JSON with appropriate HTTP status codes

## LLM Client Pattern

Both DeepSeek and Claude clients implement the same `LLMClient` interface.
DeepSeek uses OpenAI-compatible SDK. Claude uses Anthropic SDK.
Router in `lib/ai/router.ts` selects by user tier.

## Firestore Patterns

- User docs: `users/{uid}` — profile, tier, stripe IDs
- Usage tracking: `users/{uid}/usage/{YYYY-MM}` — token counts
- Conversations: `conversations/{id}` with `messages` subcollection
- Security rules: users can only read/write their own documents
