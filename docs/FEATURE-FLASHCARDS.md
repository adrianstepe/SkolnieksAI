# Feature: Flashcards from Chat — Implementation Plan

> **Scope:** Student clicks "Saglabāt kā kartītes" at any point in a chat. Claude extracts key concept pairs (term → definition) from the conversation. Cards saved per user. A "Kartītes" tab lists all decks. Review mode shows one card at a time, student flips and marks as "Iemācījos" / "Jāatkārto". Basic SR: two buckets, cards marked for review resurface after a fixed number of sessions.
>
> **Status:** Spec — not implemented. Drop this file at `docs/FEATURE-FLASHCARDS.md`.
>
> **Positioning:** Flashcards are a *study aid*, not a test. The extraction should feel like "the AI took notes for you." No red/green shame colors — use emerald and a soft amber.

---

## 1. UX flow

### 1.1 Create deck from chat

1. Anywhere in the chat input toolbar (next to the attach button), a secondary action appears: **"💾 Saglabāt kā kartītes"**. Visible only after the conversation has at least 2 assistant messages (otherwise there's nothing to extract).
2. Student taps it → small non-blocking toast: "Veidojam kartītes…" (animated dots).
3. When extraction finishes (≤ 8 s):
   - Toast becomes: "Izveidotas N kartītes → Kartītes" (tappable, routes to the new deck in the Kartītes tab).
   - If N < 3 → toast says "Nepietiek satura kartītēm — parunā vēl drusku ar AI." (soft, no error styling).
4. Under the hood, a new deck is created under `users/{uid}/decks/{deckId}` with all extracted cards.
5. If the same conversation is extracted a second time, a **new** deck is created (student's choice — they may have talked about new topics). Do **not** append to the existing deck. We'd rather have 5 small topical decks than 1 mega-deck.

### 1.2 Kartītes tab

- New primary nav tab in the chat header, next to Learn / Uzdevumi / Progress: **"Kartītes"**.
- Route: `/kartites` (new page).
- Layout:
  - Header: "Manas kartītes" + count of total cards across all decks + "Sākt atkārtot" button (only shown if ≥ 1 deck has cards due).
  - Deck grid (responsive 1 col mobile → 2 col tablet → 3 col desktop).
  - Each deck card shows: title (from convo), card count, `N gatavas atkārtot` badge (cards due this session), created date, subject badge (using existing subject color system), kebab menu (rename, delete).
  - Empty state: illustration + "Vēl nav nevienas kartītes. Parunā ar AI un pēc tam saglabā kā kartītes."

### 1.3 Review mode

- Entered by tapping a deck OR the top-right "Sākt atkārtot" button (which starts a mixed review session of all due cards across all decks).
- One card at a time, center of screen on mobile, contained to ~640px width on desktop.
- **Front side** (term / question): big type, tap to flip.
- **Back side** (definition / answer): same card, CSS flip animation (300 ms, ease-out, no bounce).
- Two buttons, always visible below the card — not hidden behind the flip:
  - **"Vēlreiz"** — ambient amber color. Marks card `bucket: "review"`, `nextDue: session + REVIEW_DELAY_SESSIONS`.
  - **"Zinu"** — emerald. Marks card `bucket: "known"`, `nextDue: session + KNOWN_DELAY_SESSIONS`.
- Progress indicator top-right: `3/12`.
- At the end of the session:
  - Summary screen: "Pabeigts! X zināmas, Y atkārtosies." + "Atgriezties" button.
- Swipe gestures on mobile (left = Vēlreiz, right = Zinu). `react-swipeable` — already in repo, confirm before using.
- Keyboard shortcuts on desktop: Space to flip, `1` = Vēlreiz, `2` = Zinu, `←` back.

### 1.4 Copy & tone

- Never "Pareizi" / "Nepareizi" on flashcards — it's self-assessment, not grading.
- "Vēlreiz" means "let me see this again soon" (not "you failed").
- No streaks or XP on flashcards for MVP. Keep it quiet and focused.
- Review session completion screen: "Labs darbs — {N} kartītes šodien 💪". No confetti.

---

## 2. Tier gating & limits

| Tier | Max decks saved | Extraction LLM | Cards per extraction |
|------|-----------------|----------------|----------------------|
| free | 5 decks | DeepSeek V3.2 | 5–10 |
| pro | Unlimited | Claude Sonnet 4.6 | 8–15 |
| premium | Unlimited | Claude Sonnet 4.6 | 8–15 |
| school_pro | Unlimited | Claude Sonnet 4.6 | 8–15 |

**Why limit free:** a cap gives a concrete upgrade reason, and 5 decks is genuinely useful for a free user. Paid tiers also get better extraction (Claude pulls more nuanced pairs).

When a free user hits the 5-deck ceiling:
- Extraction API returns `403 { error: "deck_limit_reached", limit: 5 }`.
- UI toast: "Esi sasniedzis 5 kartīšu komplektu robežu. Dzēs kādu vai izmēģini Pro."
- The "Izmēģini Pro" text is a link to the upgrade modal.

Tokens count toward the monthly budget (same as chat, same as quiz).

---

## 3. Spaced repetition logic

Not SM-2 or FSRS — too complex for MVP and unnecessary for a first launch. Use a **two-bucket system with session-count-based scheduling**:

```ts
const KNOWN_DELAY_SESSIONS = 3;   // "Zinu" → don't show again for 3 review sessions
const REVIEW_DELAY_SESSIONS = 1;  // "Vēlreiz" → show again next session
const NEW_CARD_IMMEDIATE = 0;     // new cards always in the current session
```

### Session counter

- Each user has a `reviewSessionCount` integer in their `users/{uid}` doc.
- Incremented by 1 each time a review session **completes** (not on start — avoids inflating count on abandoned sessions).
- A session counts as complete if the user reviewed ≥ 1 card and tapped "Atgriezties" OR closed the tab with ≥ 50% of due cards done.

### Card scheduling

Each card has:
```
bucket: "new" | "known" | "review"
lastReviewedAt: ISO string | null
nextDueSession: number    // compare against users.reviewSessionCount
reviewCount: number       // total times reviewed
```

Due = `bucket === "new"` OR `nextDueSession <= user.reviewSessionCount`.

When student marks a card:
- **Zinu**: `bucket = "known"`, `nextDueSession = currentSession + KNOWN_DELAY_SESSIONS`.
- **Vēlreiz**: `bucket = "review"`, `nextDueSession = currentSession + REVIEW_DELAY_SESSIONS`.

### Edge cases

- A card marked "Vēlreiz" 3 sessions in a row stays in review bucket — that's fine. We don't escalate or tag "hard cards" in MVP.
- When a deck is reviewed and all cards marked "Zinu", no cards are due for `KNOWN_DELAY_SESSIONS` sessions. The deck shows `0 gatavas atkārtot` and the "Sākt atkārtot" button is disabled for it. Student can still tap "Skatīt visas" to see all cards regardless of due state.

### Why this works for MVP

- Simple enough to ship in a day.
- Still gives "forgetting curve" behavior with zero ML.
- If analytics show students want more granularity, upgrade to SM-2 or FSRS post-launch.

---

## 4. Firestore data model

```
users/{uid}
  ├── reviewSessionCount: number              // new field, default 0
  └── decks/{deckId}
        ├── title: string                     // generated from convo title or subject + date
        ├── conversationId: string            // source convo
        ├── subject: string
        ├── grade: number
        ├── createdAt: ISO string
        ├── updatedAt: ISO string
        ├── cardCount: number                 // denormalized for fast deck list
        ├── knownCount: number                // cards currently in "known" bucket
        ├── reviewCount: number               // cards currently in "review" bucket
        └── cards/{cardId}
              ├── front: string               // term or question
              ├── back: string                // definition or answer
              ├── bucket: "new" | "known" | "review"
              ├── nextDueSession: number      // 0 for new cards
              ├── lastReviewedAt: ISO string | null
              ├── reviewCount: number
              └── createdAt: ISO string
```

**Why a subcollection for cards (not embedded array):**
- A single deck may have 15+ cards, updated individually during review. Embedded arrays mean rewriting the whole deck doc on every review → wasteful. Subcollection = update one card at a time.
- Still cheap reads: listing deck cards is a single query.

**Denormalized counts (`cardCount`, `knownCount`, `reviewCount`):**
- Updated in a Firestore transaction when a card is reviewed or added.
- Avoids a count query on the deck list page.
- Transaction overhead is fine at this scale.

### Security rules

```
match /users/{uid}/decks/{deckId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
  match /cards/{cardId} {
    allow read, write: if request.auth != null && request.auth.uid == uid;
  }
}
```

Covered by the existing `users/{uid}/**` rule but add explicit for clarity.

### Index requirements

- `users/{uid}/decks/{deckId}/cards` ordered by `nextDueSession ASC, createdAt ASC` — for fetching due cards. Single-field sort + equality filter → no composite index needed.

---

## 5. API routes

### 5.1 `POST /api/flashcards/extract`

**Input:**
```ts
{ conversationId: string }
```

**Flow:**
1. Auth + conversation ownership check.
2. Free tier only: count existing decks. If ≥ 5, return `403 { error: "deck_limit_reached", limit: 5 }`.
3. Fetch all messages in the conversation (ordered ASC). If fewer than 2 assistant messages, return `400 { error: "not_enough_content" }`.
4. Truncate if needed: keep first system-like intro + last 20 messages (to stay within LLM context).
5. Call LLM with the extraction prompt (§6).
6. Parse JSON (`{ cards: [{ front, back }] }`). Validate with Zod: 3–15 cards, each `front` 1–80 chars, `back` 1–300 chars.
7. If parse fails, retry once with strict instruction. If still fails, return `500 { error: "extraction_failed" }`.
8. Create deck doc + batch-create cards in a single transaction.
9. Log tokens.
10. Return `{ deckId, cardCount }`.

**Cost note:** one LLM call per extraction. No per-card calls.

### 5.2 `GET /api/flashcards/decks`

Returns list of decks for the user, ordered by `updatedAt DESC`. Include a `dueCount` computed per deck by counting cards where `bucket === "new" OR nextDueSession <= user.reviewSessionCount`. This is N+1 queries in a naive implementation; for MVP do it once per deck in parallel (`Promise.all`). Acceptable for ≤ 20 decks.

### 5.3 `GET /api/flashcards/decks/:deckId`

Returns deck metadata + all cards (no pagination — cards per deck are capped at 15).

### 5.4 `POST /api/flashcards/decks/:deckId/review`

**Input:**
```ts
{
  cardId: string,
  outcome: "known" | "review"
}
```

**Flow:**
1. Auth + ownership check.
2. Transaction:
   - Read user's current `reviewSessionCount`.
   - Read card's current `bucket`.
   - Compute new `nextDueSession`.
   - Update card.
   - Update deck denormalized counts (`knownCount`, `reviewCount`).
3. Return `{ nextDueSession, bucket }`.

### 5.5 `POST /api/flashcards/session/complete`

Called by the client when a review session ends. Increments `users/{uid}.reviewSessionCount` by 1. Idempotent-ish: client must pass a `sessionStartedAt` timestamp; server ignores the call if < 30 s have passed since the session started (prevents abuse and accidental double-counting).

### 5.6 `DELETE /api/flashcards/decks/:deckId`

Deletes deck + all cards (batch). Used from the kebab menu in the deck list.

### 5.7 `PATCH /api/flashcards/decks/:deckId`

Rename: `{ title: string }`.

---

## 6. Extraction prompt

File: `lib/flashcards/prompts.ts`

```ts
export function buildFlashcardExtractionPrompt(params: {
  subject: string;
  grade: number;
  conversationText: string;
  minCards: number;   // 5 free, 8 paid
  maxCards: number;   // 10 free, 15 paid
}): { system: string; user: string } {
  const system = `Tu esi skolotājs, kas no sarunas ar skolēnu izvelk kartītes mācībām.

UZDEVUMS:
No dotās sarunas izveido ${params.minCards}–${params.maxCards} kartītes.

KĀDAS KARTĪTES JĀVEIDO:
- Jēdziens → definīcija (piem., "Fotosintēze" → "Process, kurā augi no saules gaismas ražo enerģiju")
- Jautājums → atbilde (piem., "Kas ir Rīgas pils galvenā funkcija?" → "Latvijas prezidenta rezidence")
- Formula → ko tā dara (piem., "a² + b² = c²" → "Pitagora teorēma taisnleņķa trijstūrim")
- Vārds → tulkojums (ja priekšmets ir svešvaloda)

KĀDAS NEVEIDOT:
- Pārāk garas (virs 300 zīmēm aizmugurē).
- Tukšas vai acīmredzamas ("Kas ir Latvija?" → "Valsts").
- No skolēna paša jautājumiem — tikai no AI skaidrojumiem un faktiem.
- Dublikātus.

PRIEKŠMETS: ${params.subject}, ${params.grade}. klase.

ATBILDES FORMĀTS — TIKAI JSON:

{
  "cards": [
    { "front": "...", "back": "..." },
    ...
  ]
}`;

  const user = `SARUNA:
${params.conversationText}

Izveido kartītes JSON formātā.`;

  return { system, user };
}
```

**Post-processing:**
- Dedup cards with identical `front` (case-insensitive trim).
- Trim whitespace.
- Reject cards where `front === back` (garbage output).

---

## 7. Files to create

### Types
- `lib/flashcards/types.ts` — `Deck`, `Card`, `ReviewOutcome`, request/response DTOs.

### Prompts & logic
- `lib/flashcards/prompts.ts`
- `lib/flashcards/extract.ts` — LLM call, validation, Firestore write.
- `lib/flashcards/scheduling.ts` — `computeNextDueSession(outcome, currentSession)`, `isDue(card, currentSession)`, pure functions, fully testable.

### API routes
- `app/api/flashcards/extract/route.ts`
- `app/api/flashcards/decks/route.ts` (GET list)
- `app/api/flashcards/decks/[deckId]/route.ts` (GET one, PATCH, DELETE)
- `app/api/flashcards/decks/[deckId]/review/route.ts`
- `app/api/flashcards/session/complete/route.ts`

### Page + components
- `app/(dashboard)/kartites/page.tsx` — the Kartītes tab page. Server component that auth-checks then renders `<FlashcardsClient />`.
- `components/flashcards/FlashcardsClient.tsx` — top-level client component: deck list + routing to review mode.
- `components/flashcards/DeckCard.tsx` — single deck tile in the grid.
- `components/flashcards/DeckEmptyState.tsx` — "Vēl nav kartīšu" illustration + CTA.
- `components/flashcards/ReviewMode.tsx` — the full-screen review UI. Manages session state with `useReducer`.
- `components/flashcards/Flashcard.tsx` — the single card with flip animation.
- `components/flashcards/ReviewSessionSummary.tsx` — end-of-session screen.
- `components/chat/SaveAsFlashcardsButton.tsx` — the button in the chat input toolbar.

### Integration
- Modify `components/chat/ChatInput.tsx` — add the save-as-flashcards secondary action next to attach.
- Modify `components/chat/ChatContainer.tsx` — add "Kartītes" nav tab.
- Add route to whatever nav config the existing tabs (Uzdevumi, Progress) use — should be the same pattern.

### Tests
- `lib/flashcards/scheduling.test.ts` — Vitest unit tests for scheduling (pure functions, fast).
- `lib/flashcards/extract.test.ts` — LLM mock, validation.
- `components/flashcards/ReviewMode.test.tsx` — Vitest + React Testing Library. Tap through a session.
- `tests/flashcards.e2e.ts` — Playwright. Full flow: chat → save → go to Kartītes → review → session summary.

---

## 8. Flip animation

Not a library. Pure CSS transform, wrapped in a reusable `<Flashcard>`.

```tsx
<div
  className={`
    relative w-full h-full
    transition-transform duration-300 ease-out
    [transform-style:preserve-3d]
    ${flipped ? "[transform:rotateY(180deg)]" : ""}
  `}
  onClick={onFlip}
  role="button"
  aria-label={flipped ? "Rādīt priekšu" : "Rādīt aizmuguri"}
  tabIndex={0}
  onKeyDown={(e) => { if (e.key === " ") onFlip(); }}
>
  <div className="absolute inset-0 [backface-visibility:hidden] ...">
    {front}
  </div>
  <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] ...">
    {back}
  </div>
</div>
```

- Respect `prefers-reduced-motion`: if set, skip the transform and just swap content.
- Card container dimensions: `aspect-[3/2]` on mobile, fixed `480×320` on desktop.

---

## 9. Navigation integration

Flashcards is a top-level tab — it lives alongside Learn / Uzdevumi / Progress. From the existing `ChatContainer.tsx` header snippet you have:

```tsx
<nav className="hidden items-center gap-1 md:flex ml-2">
  <button onClick={() => setActiveTab("learn")}>Mācīties</button>
  <button onClick={() => setActiveTab("tasks")}>Uzdevumi</button>
  <button onClick={() => setActiveTab("progress")}>Progress</button>
</nav>
```

Flashcards doesn't fit this tab state pattern because it's a full page, not a view swap inside ChatContainer. Two options:

- **Option A (preferred):** Promote Flashcards to a real route `/kartites`. Add it to whatever top-level nav component you use for logged-in users. If the existing tabs are in-chat view swaps, treat Flashcards differently — it's a page.
- **Option B:** Keep it in the in-chat tab pattern, render `<FlashcardsClient />` when `activeTab === "flashcards"`. Simpler, but the deep-link from the "Izveidotas N kartītes" toast breaks.

**Pick Option A.** It lets you deep-link, bookmark, and it's cleaner for the mobile bottom nav if you add one later.

**Mobile nav:** on mobile, the tab row is hidden behind the hamburger. Add "Kartītes" to the sidebar nav items too.

---

## 10. Analytics events

| Event | Params |
|-------|--------|
| `flashcards_extracted` | `deckId, cardCount, subject, tier` |
| `flashcards_extraction_failed` | `tier, errorCode` |
| `flashcards_deck_limit_hit` | (free tier) |
| `flashcards_review_started` | `deckId OR "all", cardsDue` |
| `flashcards_card_reviewed` | `cardId, outcome, reviewCount` |
| `flashcards_session_completed` | `cardsReviewed, knownCount, reviewCount` |
| `flashcards_deck_deleted` | `deckId, cardCount` |

---

## 11. Acceptance criteria

1. From an active chat with ≥ 2 AI messages, tapping "Saglabāt kā kartītes" creates a new deck in ≤ 8 s.
2. Deck list page loads in ≤ 1 s for a user with ≤ 20 decks.
3. Review mode flip animation is smooth (60 fps on mid-range Android).
4. Cards marked "Zinu" do not reappear until 3 sessions later.
5. Free tier cannot create a 6th deck — sees the upgrade prompt.
6. Session abandonment (closing tab mid-session) does not double-count the session.
7. Keyboard navigation works: Tab to focus card, Space to flip, 1/2 to rate.
8. Mobile swipe left/right works and is undoable (undo not in MVP, but swipes shouldn't accidentally register twice).
9. Latvian only. Every string.
10. Deleting a deck deletes all cards (no orphans in Firestore).

---

## 12. Rollout

1. Flag `NEXT_PUBLIC_FLASHCARDS_ENABLED` default false.
2. Ship backend + page behind flag.
3. Seed 3 test decks in a dev account, test review flow end-to-end.
4. Flip flag in production.
5. Monitor for 1 week: extraction failure rate < 2%, session completion rate > 40%.
6. Remove flag.

---

## 13. Out of scope for MVP

- SM-2 / FSRS spaced repetition. Two-bucket is enough.
- Importing external flashcard decks (Anki etc.).
- Sharing decks between students.
- AI-generated images on cards.
- Audio / pronunciation playback.
- Merging decks.
- Multi-card bulk edit.
- Exporting to CSV.

Collect usage data for 30 days before building any of these.
