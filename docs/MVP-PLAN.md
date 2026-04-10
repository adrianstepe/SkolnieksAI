# MVP Build Plan — SkolnieksAI

Target launch: Late April / Early May 2026

## Phase 1: RAG Foundation (Week 1–2)

**Goal**: Prove that OpenStax and Wikipedia RAG answers beat raw ChatGPT for Latvian curriculum questions.

### Tasks
- [ ] Set up ChromaDB locally (Docker or direct install)
- [ ] Write `scripts/ingest.ts` — parse sample OpenStax PDFs with pdf-parse
- [ ] Chunk, embed (sentence-transformers), and store in ChromaDB
- [ ] Write `lib/rag/retriever.ts` — query ChromaDB with filters
- [ ] Write `lib/rag/chain.ts` — build prompt with Latvian system message + chunks
- [ ] Connect to DeepSeek V3.2 API (`deepseek-chat` endpoint)
- [ ] Build `scripts/eval-rag.ts` — 10 test questions, check retrieval quality
- [ ] **Record side-by-side**: SkolnieksAI vs raw ChatGPT on same questions (for TikTok content)

### Acceptance Criteria
- Retrieval recall >80% on test set
- Responses are in Latvian, reference curriculum sections
- DeepSeek API cost per query <€0.001

## Phase 2: Chat UI (Week 2–3)

**Goal**: Usable chat interface that feels native to Latvian students.

### Tasks
- [ ] Initialize Next.js 14 project with App Router + Tailwind
- [ ] Build root layout with Latvian locale, custom fonts
- [ ] Create `/api/chat` route — accepts message, runs RAG, streams response
- [ ] Build chat UI components: message bubbles, input bar, typing indicator
- [ ] Add subject/grade selector (dropdown or pills)
- [ ] Conversation history (client-side state first, Firestore later)
- [ ] Mobile-responsive design (most students on phones)
- [ ] Deploy to Vercel — confirm it works on live URL
- [x] KaTeX streaming buffer fix — prevents broken LaTeX flash during token streaming
- [x] Empty state: grade-aware starter prompts with camera coach mark

### Acceptance Criteria
- Chat works end-to-end on mobile Chrome
- Streaming responses feel snappy (<2s first token)
- All UI text in Latvian

## Phase 3: Auth + Tier Gating (Week 3–4)

**Goal**: Users can sign up, and free users hit a soft token budget wall.

### Tasks
- [x] Set up Firebase project (EU region)
- [x] Integrate Firebase Auth (email + Google sign-in)
- [x] Create auth pages: `/login`, `/signup` (Latvian UI)
- [x] Middleware: protect `/api/chat` and dashboard routes
- [x] Firestore: create user doc on signup with `tier: 'free'`
- [x] Token tracking: log input/output tokens per query to `usage/{YYYY-MM}`
- [x] Usage gate: check budget before calling LLM, return upgrade prompt if exhausted
- [x] Firestore security rules: users own their data
- [x] GDPR compliance: implement age gating and parental consent flow for users < 13

### Acceptance Criteria
- Cannot access chat without auth
- Free user can ask ~60 questions before seeing upgrade prompt
- Token counts match DeepSeek's usage reporting

## Phase 4: Stripe Payments (Week 4–5)

**Goal**: Users can pay. Revenue flows.

### Tasks
- [x] Register SIA with Stepe Digital (~€280) — REQUIRED before live payments
- [x] Create Stripe account, get live API keys
- [x] Build pricing page: Free / Pro (€5.99) / Premium (€14.99)
- [x] Stripe Checkout session creation from pricing page
- [x] Webhook handler: `checkout.session.completed` → update Firestore tier
- [x] Webhook handler: `customer.subscription.deleted` → downgrade to free
- [x] Webhook signature validation (critical security)
- [x] Pro and Premium users routed to Claude Sonnet 4.6 instead of DeepSeek
- [x] Test full flow: signup → free use → hit limit → pay → pro/premium access
- [x] Web search domain allowlist (izm.gov.lv, skola2030.lv, visc.gov.lv, viaa.gov.lv, maciunmaci.lv, likumi.lv, wikipedia.org) + blocklist (uzdevumi.lv, brainly.com) enforced via post-fetch filter in `lib/search/web.ts`
- [x] Tier-based web source limits: bezmaksas=3, pro=6, premium/school_pro=12 (`getWebSourcesForTier` in `app/api/chat/route.ts`)

### Acceptance Criteria
- Payment flow works end-to-end in Stripe test mode
- Webhook correctly updates user tier in Firestore
- Paid user gets Claude responses, free user gets DeepSeek

## Phase 5: Soft Launch (Week 5–6)

**Goal**: Real students using the product. Tight token budget.

### Tasks
- [ ] Email IZM + VISC (same week payments go live) — frame as public-private partnership
- [ ] Start tight free tier budget (~40 questions/month initially)
- [ ] Set up basic analytics (Vercel Analytics or Plausible)
- [ ] Create landing page with clear value prop
- [ ] TikTok content: 3 vids/week, ChatGPT vs SkolnieksAI side-by-side
- [ ] Post in teacher Facebook groups with free dashboard teaser
- [ ] Referral system: 3 invites → 1 week free Pro
- [ ] Monitor: error rates, API costs, user feedback

### Acceptance Criteria
- 50+ real users in first 2 weeks
- API costs stay under €20/month
- No critical bugs in production

## Phase 6: Post-Launch Growth (Week 7+)

- Teacher Dashboard MVP (class management, usage stats)
- Flutter mobile app
- School Pro tier (€20/student/yr)
- TikToker affiliates (30% recurring)
- Facebook parent ads (€5/day during exam season Apr–Jun)
- Apply LIAA AI grant (up to €200k)
- Estonian expansion planning

## Budget Tracker

| Item                | Monthly Cost  | Notes                          |
|---------------------|---------------|--------------------------------|
| Vercel              | €0            | Free tier (hobby)              |
| ChromaDB VPS        | ~€5           | Hetzner CX11                   |
| Firebase            | €0            | Spark plan initially           |
| DeepSeek API (1k)   | ~€50          | 1k users at ~100 q/user        |
| DeepSeek API (10k)  | ~€500         | 10k users at ~100 q/user       |
| Claude API (paid)   | ~€10–50       | Only for paying subscribers     |
| Domain              | ~€10/yr       | skolnieks.ai or similar        |
| **Total (1k users)**| **~€70/mo**   |                                |
| **Total (10k user)**| **~€520/mo**  |                                |
| Break-even          | 10–25 paid subscribers                          |
