# Architecture — SkolnieksAI

> **UI:** April 2026 — simplified chat chrome: personalised empty-state greeting (Sora, first name), 2×2 chip grid, muted sidebar labels, no topbar progress bar or exam countdown.

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
      │ Chroma   │  │ DeepSeek   │  │ Claude   │
      │ Cloud    │  │ V3.2 (free)│  │ Sonnet   │
      └──────────┘  └────────────┘  │ (paid)   │
                                    └──────────┘
```

## Chat Request Flow

1. Student types question → `POST /api/chat` with `{ message, conversationId, subject?, grade? }`
2. Middleware verifies Firebase Auth token → reject if invalid
3. Usage gate: read `users/{uid}/usage/{YYYY-MM}` → check token budget remaining
4. RAG retrieval:
   - Embed query with `@xenova/transformers` (`paraphrase-multilingual-MiniLM-L12-v2`, runs in Node.js)
   - Query Chroma Cloud (`skolnieks_content` collection) top-k chunks, filtered by subject metadata
   - No Python server needed — `lib/rag/retriever.ts` connects to Chroma Cloud directly via `chromadb` npm `CloudClient`
   - Future: rerank step for quality
5. Build prompt: system message (Latvian, Skola2030, grade) + retrieved chunks + user message. Response strategy: factual questions answered directly in the first sentence; math/calculations solved fully step-by-step; essay/homework structure guided with one concrete hint; student who explicitly requests a direct answer always receives one regardless of question type.
6. Route to LLM: free → DeepSeek V3.2, paid → Claude Sonnet 4.6
7. Stream response via Vercel AI SDK (SSE)
8. Post-response: log tokens to Firestore usage doc, append to conversation
9. **Exam countdown** (client-side): `lib/exams/latvianExams.ts` computes days until nearest centralized exam date; a pill badge is rendered in the chat header for grades 9 and 12 when ≤90 days remain. Color: emerald (>60d), amber (30–60d), red (<30d).
10. **Contextual upgrade trigger** (client-side): after each successful assistant response, if the user is on the free tier, is in grade 9 or 12, and their message matches any keyword in `EXAM_UPGRADE_KEYWORDS`, a soft inline banner ("Gatavojies eksāmenam ar AI simulācijām → Izmēģini Premium") is shown below the response. Shown at most once per browser session via `sessionStorage`. The `UpgradeModal` also switches to exam-specific copy (heading, body, CTA) when `grade` is 9 or 12.

## Firestore Data Model

```
users/{uid}
  ├── email, displayName, tier (free|pro|premium|school_pro)
  ├── grade (6-12), school?, createdAt, birthYear, isMinor
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

Collection: `skolnieks_content` (Chroma Cloud)

Document shape:
- `id`: hash of (pdf_filename + page + chunk_index)
- `document`: text chunk (~500 tokens)
- `embedding`: 384-dim (`paraphrase-multilingual-MiniLM-L12-v2`)
- `metadata`: `{ source_pdf, subject, grade_min, grade_max, page_number, chunk_index }`

Production retrieval path: `lib/rag/retriever.ts` → `chromadb` npm `CloudClient` → Chroma Cloud. No Python server or localhost:8001 dependency.

## Deployment Targets

| Service     | Host               | Cost        |
|-------------|--------------------|-----------  |
| Frontend+API| Vercel (free tier) | €0/mo       |
| Chroma Cloud| trychroma.com      | Free tier   |
| Firebase    | Spark → Blaze      | €0 → usage  |
| Stripe      | Standard           | 1.4% + €0.25|

## Math Rendering

Assistant messages are rendered through **react-markdown** with **remark-math** and **rehype-katex** (KaTeX). Three layers work together to keep math stable during token streaming:

### 1. LaTeX-only rule in the system prompt

`buildSystemPrompt` in `lib/rag/chain.ts` appends a `MATEMĀTIKAS FORMATĒŠANA` rule to every LLM call. It instructs the model to use `$...$` for inline math and `$$...$$` for block math, and explicitly forbids placing math inside code fences. This reduces the rate of malformed LaTeX at the source.

### 2. KaTeX streaming buffer (`hooks/useStreamingMarkdown.ts`)

LLM tokens arrive one at a time. If a `$` delimiter has arrived but its closing `$` has not yet, passing the partial string to KaTeX throws a parse error. The `useStreamingMarkdown(rawContent)` hook solves this by scanning the accumulated stream and returning only the longest prefix that contains no unclosed `$` or `$$` span:

- Characters outside any math block are flushed immediately.
- On seeing `$` or `$$`, the hook freezes `safeContent` at the character before the opening delimiter.
- `safeContent` advances past the closing delimiter only once it arrives.
- `AssistantMessageContent` (inside `ChatMessage.tsx`) calls the hook and passes `safeContent` to `<ReactMarkdown>` instead of the raw stream.

### 3. MathErrorBoundary (`components/chat/MathErrorBoundary.tsx`)

A React class component wrapping `<ReactMarkdown>`. If KaTeX throws despite the buffer (e.g. the LLM produced structurally invalid LaTeX), the boundary catches the error and renders the raw string in a styled `<code>` block rather than crashing the message bubble. The boundary auto-resets when `rawContent` changes, so a corrected subsequent chunk retries rendering automatically.

### KaTeX CSS

`app/globals.css` sets `.katex-display { overflow-x: auto }` and `.katex { font-size: 1em }` to prevent wide display-math from causing horizontal scroll on mobile and to stop KaTeX's default 1.21em size from looking oversized on small screens.

## Auth Components

Auth pages live under `app/(auth)/` and share a centered card layout via `app/(auth)/layout.tsx`.

| Page                        | File                                    |
|-----------------------------|-----------------------------------------|
| Login                       | `app/(auth)/login/page.tsx`             |
| Sign up                     | `app/(auth)/signup/page.tsx`            |
| Forgot password             | `app/(auth)/forgot-password/page.tsx`   |
| Reset password              | `app/(auth)/reset-password/page.tsx`    |
| Email verification          | `app/verify-email/page.tsx`             |

### Email Verification Flow

Email/password signups require address verification before accessing the app. Google sign-ins are exempt (Google already verifies the address).

1. After `createUserWithEmailAndPassword` succeeds, `sendEmailVerification(user)` is called and the user is redirected to `/verify-email`.
2. `/verify-email` shows "Pārbaudiet savu e-pastu..." with two actions:
   - **Esmu apstiprinājis** — calls `user.reload()` via `reloadUser()` in `AuthContext`; if `emailVerified` is now true, redirects to `/`.
   - **Nosūtīt vēlreiz** — calls `sendEmailVerification(user)` again (60-second cooldown).
3. `app/(auth)/layout.tsx` redirects authenticated users: verified → `/`, unverified → `/verify-email`.
4. `app/page.tsx` guards the dashboard: if `user.emailVerified === false`, redirects to `/verify-email` before rendering `ChatContainer`.

`AuthContext` exposes `reloadUser()` and `sendVerificationEmail()` to avoid direct Firebase imports in page components.

Each auth page header displays the **"S" monogram** — a bold off-white (`#F9FAFB`) "S" character centered inside a Royal Blue (`#2563EB`) 48×48 px rounded square — instead of a generic icon. The monogram uses the Sora font to match the `LogoWordmark` component.

## Landing Page Architecture

The root route (`/`) serves a dual purpose: authenticated users see the full chat app (`ChatContainer`), while unauthenticated visitors see a full marketing landing page — no login wall.

### Sections

The landing page is composed of discrete section components, each in its own file under `components/landing/`:

| Component              | Client? | Description |
|------------------------|---------|-------------|
| `Navbar.tsx`           | Yes     | Sticky nav with LogoWordmark; collapses on scroll, transparent → blurred bg |
| `Hero.tsx`             | Yes     | Animated headline, badge, dual CTA (desktop) + fixed bottom CTA (mobile) |
| `InteractiveDemo.tsx`  | Yes     | 4 hardcoded question cards + typewriter response + post-demo signup CTA |
| `HowItWorks.tsx`       | No      | 3-step "how it works" cards (ask → AI explains → you understand) |
| `SubjectGrid.tsx`      | No      | Subject pill grid (Matemātika, Fizika, etc.) for grades 6–12 |
| `Pricing.tsx`          | No      | 3-tier pricing cards (Bezmaksas / Pro / Premium) with signup links |
| `FAQ.tsx`              | Yes     | Accordion FAQ with AnimatePresence expand/collapse |
| `FinalCTA.tsx`         | No      | Full-width glass-card CTA block |
| `Footer.tsx`           | No      | LogoWordmark + legal links (terms, privacy) |

Entry point: `app/page.tsx` — auth-branches between `ChatContainer` (logged in) and the landing page composition (anonymous).

### Pre-login Interactive Demo

Visitors can interact with the product before signing up. This is implemented as a **constrained preview** with zero API calls:

- `InteractiveDemo.tsx` renders 4 tappable question cards in a 2×2 grid
- Each card maps to a **hardcoded Latvian response string** stored in the component
- On tap, a typewriter animation (15 ms/char interval) simulates a streamed AI reply
- After the animation completes, an inline signup CTA appears
- `AnimatePresence` handles mount/unmount transitions between different answers

**Why no live API calls on the landing page:**
1. Zero cost — no token spend on anonymous visitors
2. Zero latency variance — demo is always instant regardless of backend load
3. Controlled messaging — responses are reviewed and Socratic-style by design
4. No auth required — ChromaDB/LLM stack is never exposed to unauthenticated traffic

### Signup Gate Strategy

The demo is designed to create curiosity, not to satisfy it:
- Responses end with a guiding question back to the student
- The post-typewriter CTA ("Reģistrējies bez maksas") appears only after the full response renders, maximising engagement before the conversion ask
- Sticky bottom CTA (mobile-only, `md:hidden`) ensures the signup prompt is always visible during scroll on small screens without overlapping desktop layout

### CSS Utilities

- `glass-card`: surface-colored card with subtle border and backdrop-blur (defined in `globals.css`)
- `glow-primary`: box-shadow halo using the primary colour for CTA buttons
- `font-heading`: Sora font family for section headings
- All colours reference existing CSS custom properties (`--color-primary`, `--color-surface`, etc.) — no new colour values introduced

## Web Search Domain Policy

When RAG retrieval is not confident (Path B), the chain falls back to `lib/search/web.ts`. Results are subject to a strict domain policy applied **post-fetch** before any content reaches the LLM context.

### Allowlist (only these domains are accepted)

| Domain | Purpose |
|---|---|
| `izm.gov.lv` | Ministry of Education and Science |
| `skola2030.lv` | Skola2030 curriculum framework |
| `visc.gov.lv` | State Education Content Centre |
| `viaa.gov.lv` | State Education Development Agency |
| `maciunmaci.lv` | Latvian open learning materials |
| `likumi.lv` | Latvian legislation database |
| `wikipedia.org` | Wikipedia (all subdomains, e.g. lv, en) |

### Blocklist (always excluded)

| Domain | Reason |
|---|---|
| `uzdevumi.lv` | Homework-answer site |
| `brainly.com` | Homework-answer site |

Both lists are enforced in `filterByDomainPolicy()` inside `lib/search/web.ts`. The blocklist terms are also negated in the query string (`-site:...`) to bias search-engine ranking away from them before results are even fetched.

### Tier-based max web sources

The number of web snippets surfaced per query is gated by subscription tier:

| Tier | Max web sources |
|---|---|
| bezmaksas (free) | 3 |
| pro | 6 |
| premium / school_pro | 12 |

`getWebSourcesForTier(tier)` in `app/api/chat/route.ts` computes the limit and passes it through `RagInput.maxWebSources` → `fetchWebContext` → `webSearch`.

## Rate Limiting Architecture

Two independent layers protect `/api/chat` from abuse:

### Layer 1 — Edge (Upstash Redis, `middleware.ts`)

| Property | Value |
|---|---|
| Algorithm | Sliding window |
| Limit | 5 requests / 60 s per user |
| Key | Firebase UID (decoded from JWT at edge); falls back to client IP |
| Rejection | HTTP 429 with `Retry-After` header |
| Fail behaviour | **Fail-open** — if Redis is unavailable the request proceeds |

The sliding window eliminates boundary-burst attacks where a fixed-window reset allowed 2× intended load across two adjacent windows. JWT decoding at the edge uses `jose`'s `decodeJwt` (no signature verification — that still happens in the route handler). This layer runs before any Firestore read, so rejected requests incur zero database cost.

Required env vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (see `docs/ENV-VARS.md`).

### Layer 2 — Route handler (Firestore transaction, `app/api/chat/route.ts`)

Business-logic limits enforced inside an atomic Firestore transaction:

| Check | Free | Pro | Premium / school_pro |
|---|---|---|---|
| Monthly token budget | 150 k tokens | 1.5 M | 3 M |
| Daily query hard cap | 15 | 40 | 80 |

These limits survive a Redis outage and are the authoritative backstop against over-consumption. The old `rateWindowStart` / `rateWindowCount` fixed-window fields have been removed from Firestore — they are no longer written or read.

### Why two layers?

- Edge layer catches burst/DDoS before any cold-start or Firestore latency.
- Firestore layer enforces per-user business quotas that must survive Redis failure and that carry subscription semantics (token budgets).

## Security Checklist

- [ ] Firebase Auth tokens verified server-side on every request
- [ ] Stripe webhook signature validation (never skip)
- [ ] Rate limit `/api/chat`: 5 req/min sliding window via Upstash Redis edge middleware (fail-open; Firestore daily cap is backstop)
- [ ] Input sanitization: max 2000 chars (HTML not stripped — see chat/route.ts L237-239)
- [ ] No PII in ChromaDB — curriculum content only
- [ ] Firestore rules: users read/write own docs only
- [ ] CORS: restrict to production domain + localhost
- [x] **CVE-2025-29927** (Next.js middleware bypass via `x-middleware-subrequest`): Not vulnerable — running Next.js 16.2.0 (patched ≥14.2.25 / ≥15.2.3). Defense-in-depth: `middleware.ts` rejects any request carrying that header with HTTP 400. Note: `/api/chat` auth must be verified independently in the route handler (do not rely solely on middleware), since middleware only covers `/admin-dashboard` paths.
