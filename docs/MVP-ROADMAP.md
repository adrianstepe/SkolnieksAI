# MVP Roadmap — SkolnieksAI

Target launch: Late April / Early May 2026.

## Phase 1: RAG Foundation (Week 1-2)

**Goal:** Prove that Skola2030 PDFs → ChromaDB → DeepSeek produces better answers than raw ChatGPT.

- [ ] Set up ChromaDB (Docker, local)
- [ ] Write `scripts/ingest.ts` — parse PDFs with pdfplumber, chunk, embed, store
- [ ] Ingest 3-5 Skola2030 PDFs across different subjects
- [ ] Write `lib/rag/retriever.ts` — query ChromaDB, return top chunks
- [ ] Build RAG prompt template (Latvian system prompt, context injection)
- [ ] Connect to DeepSeek V3.2 API — verify streaming works
- [ ] Write 15+ benchmark Q&A pairs
- [ ] Run `npm run rag:test` — hit >80% retrieval relevance
- [ ] **Milestone:** Side-by-side demo — SkolnieksAI vs ChatGPT on Latvian curriculum questions

**Deliverable:** Working RAG pipeline in terminal. No UI yet.

## Phase 2: Basic Chat UI (Week 2-3)

**Goal:** Next.js chat interface on Vercel. No auth yet — open access for testing.

- [ ] `npx create-next-app` with TypeScript + Tailwind + App Router
- [ ] Build chat UI components: message list, input box, streaming display
- [ ] Create `POST /api/chat` route — connect RAG + DeepSeek
- [ ] Implement streaming responses (Edge Runtime + ReadableStream)
- [ ] Add conversation persistence (Firestore)
- [ ] Latvian UI strings (hardcoded first, i18n later)
- [ ] Deploy to Vercel (free tier)
- [ ] **Milestone:** Working chat at `skolnieks-ai.vercel.app` (private, not shared)

**Deliverable:** Functional chat app. Test with 3-5 friends.

## Phase 3: Auth + Tier Gate (Week 3-4)

**Goal:** Firebase auth + free/paid tier enforcement.

- [x] Set up Firebase project (europe-west1)
- [x] Implement sign-up / login pages (email + Google)
- [x] Age verification + parental consent flow (under 13)
- [x] Create user docs in Firestore on first sign-in
- [x] Build usage tracking: token counting per request, monthly budget
- [x] Implement tier middleware: check budget before AI call
- [x] Free tier: hidden token budget, vague "usage remaining" UI indicator
- [x] AI provider abstraction: `lib/ai/provider.ts` (DeepSeek + Claude)
- [x] **Milestone:** Free users hit budget limit and see upgrade prompt

**Deliverable:** Auth-gated app with working usage limits.

## Phase 4: Stripe + Go Live (Week 4-5)

**Goal:** Payments working. Token budget unlocked for paid users. Safe to share URL.

- [x] Stripe products + prices created (Pro, Premium)
- [x] `POST /api/stripe/checkout` — create Checkout session
- [x] `POST /api/webhooks/stripe` — handle subscription events
- [x] Tier upgrade/downgrade reflected in Firestore immediately
- [x] Pricing page with clear plans and CTA
- [x] Customer portal for subscription management
- [x] Test full payment flow with Stripe test cards
- [x] Privacy policy + Terms of service pages (Latvian)
- [x] **Milestone:** Complete paid flow — sign up → pay → unlimited access

**Deliverable:** Production-ready app safe to share publicly.

## Phase 5: Soft Launch (Week 5-6)

**Goal:** First real users. Tight token budget. Gather feedback.

- [-] Referral system: invite codes, reward logic (in progress)
- [-] Landing page with value proposition + CTA (in progress)
- [x] Exam countdown + contextual upgrade prompts for grades 9 and 12
- [ ] Set free tier budget conservatively (~40 questions to start)
- [ ] Share with 20-30 students for beta testing
- [ ] Email IZM + VISC (partnership inquiry)
- [ ] Start TikTok content (ChatGPT vs SkolnieksAI side-by-side)
- [ ] Monitor costs: track DeepSeek API spend daily
- [ ] **Milestone:** 50+ registered users, 3+ paying subscribers

## Phase 6: Growth (Post-Launch)

- [ ] Teacher dashboard (class stats, usage reports)
- [ ] School Pro tier + B2B sales
- [ ] Flutter mobile app
- [x] Register SIA Stepe Digital (~€280)
- [ ] Apply LIAA AI grant
- [ ] TikToker affiliate partnerships
- [ ] Facebook parent ads (€5/day during exam season Apr-Jun)
- [ ] Press outreach: Delfi.lv, LSM.lv

## Revenue Targets

| Month | Target | How |
|-------|--------|-----|
| 1-2 | €300-500 | Early adopters, organic signups |
| 3-4 | €2-4k | TikTok viral, exam season push |
| 5-6 | €5-8k | Sustained growth, first affiliates |
| 10-12 | €8-15k | First B2B school deal |

## Monthly Cost Projections

| Users (free) | Paid subs | DeepSeek cost | Infra cost | Total |
|--------------|-----------|---------------|------------|-------|
| 100 | 5 | ~€3 | ~€10 | ~€13 |
| 1,000 | 30 | ~€35 | ~€15 | ~€50 |
| 5,000 | 100 | ~€175 | ~€25 | ~€200 |
| 10,000 | 250 | ~€350 | ~€35 | ~€385 |
