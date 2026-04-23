# Feature: Quiz Me Mode — Implementation Plan

> **Scope:** After any AI response, a "Pārbaudi mani" button appears. Clicking generates 3–5 questions from the last assistant message. Student answers one at a time, gets correct/incorrect + short explanation per answer, sees a score at the end.
>
> **Status:** Spec — not implemented. Drop this file at `docs/FEATURE-QUIZ-ME.md` so Claude Code can read it.
>
> **Positioning guardrail:** Quiz must *help the student verify understanding* — never grade them harshly, never feel like an exam. Tone in all copy: encouraging, casual, Latvian.

---

## 1. UX flow

1. Student sends a question → AI replies (unchanged).
2. Under the assistant bubble (next to the thumbs up/down + "AI ģenerēta atbilde" label), a pill button appears: **"🎯 Pārbaudi mani"**. Shown only on the **latest** assistant message in a conversation (to avoid visual clutter on long chats).
3. Student clicks → inline quiz panel expands directly below the assistant message. No modal, no navigation — stays in the chat flow. Panel has a subtle card background so it reads as a distinct surface.
4. Quiz panel shows:
   - Header: "Pārbaudi sevi — 5 jautājumi" + close (X) button.
   - Small progress indicator: `1/5` top-right.
   - One question at a time. Mix of multiple choice (when LLM can produce clean options) and open-ended (short text answer).
   - For multiple choice: 4 tappable option cards.
   - For open-ended: single-line input + "Pārbaudīt" button. Enter submits.
5. On submit:
   - Shows ✓ or ✗ with a 1–2 sentence explanation in Latvian below the answer area.
   - "Nākamais" button advances. Last question says "Redzēt rezultātu".
6. Final screen inside the same panel:
   - Big score e.g. `4/5` with a friendly headline:
     - 5/5 → "Perfekti! 🎉"
     - 3–4 → "Labs darbs! 💪"
     - 0–2 → "Jāpamācās vēl drusku — tas ir OK!"
   - List of questions with your answer + correct answer + explanation (collapsed, tappable).
   - Two buttons: **"Izveidot kartītes"** (links to Feature 2 flow, pre-populates from missed questions) + **"Aizvērt"**.
7. Quiz state persists: if the user navigates away and back within the same session, the quiz is restored from `sessionStorage` (per-conversation, not per-user, so it's throwaway).

### Tone rules for copy

- Never "Nepareizi!" as a bare word — always soften: "Ne gluži. Pareizā atbilde ir…"
- Explanations short (≤ 2 sentences).
- No exclamation points outside the final celebration screen.
- "Pārbaudi mani" — never "Tests" or "Eksāmens" (avoids anxiety triggers).

---

## 2. Tier gating & model routing

| Tier | Can use Quiz? | LLM used for generation + grading |
|------|---------------|------------------------------------|
| free | ✓ | DeepSeek V3.2 |
| pro | ✓ | Claude Sonnet 4.6 |
| premium | ✓ | Claude Sonnet 4.6 |
| school_pro | ✓ | Claude Sonnet 4.6 |

**Why free gets Quiz:** it's a retention / engagement feature — more value for free users = more conversions.

**Abuse limit (free tier only):** max **5 quizzes per day**. Stored on `users/{uid}/usage/{YYYY-MM-DD}.quizCount`. Server-side, same pattern as chat daily limit. Paid tiers: no quiz limit (token budget already caps total use).

Tokens from quiz generation + grading count toward the user's monthly token budget. Append to `users/{uid}/usage/{YYYY-MM}.inputTokens` and `.outputTokens` same way chat does.

---

## 3. Firestore data model

```
users/{uid}
  └── quizzes/{quizId}
        ├── conversationId: string
        ├── messageId: string           // seed message (latest assistant msg at time of generation)
        ├── subject: string
        ├── grade: number
        ├── createdAt: ISO string
        ├── completedAt: ISO string | null
        ├── score: number | null
        ├── total: number               // 3–5
        ├── contextSnippet: string      // first 500 chars of seed message, for display in history
        └── questions: Array<{
              id: string                  // stable per-question id, e.g. q_0, q_1
              type: "multiple_choice" | "open_ended"
              question: string
              choices: string[] | null    // null for open-ended
              correctAnswer: string       // the canonical correct answer string
              correctIndex: number | null // 0..3 for MC, null for open
              userAnswer: string | null   // filled after student answers
              wasCorrect: boolean | null  // filled after student answers
              explanation: string | null  // filled after student answers
            }>
```

**Why all questions are in one document:** max 5 questions ≈ a few KB → well under Firestore 1 MiB doc limit. Avoids needing a subcollection.

**Why pre-persist the full quiz on generation:** so the client can reload it after a page refresh. Reduces the chance a student loses a quiz mid-way.

**Why a separate `users/{uid}/quizzes` collection (not under `conversations/{id}`):** quizzes are student-owned. Easier to query "all my quizzes" for a future history view. Firestore security rules on `users/{uid}/*` are already in place.

---

## 4. Firestore security rules addition

Add to `firestore.rules`:

```
match /users/{uid}/quizzes/{quizId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

That's it — the existing `users/{uid}/**` owner rule should already cover this, but add explicitly for clarity.

---

## 5. API routes

### 5.1 `POST /api/quiz/generate`

**Input (Zod):**
```ts
{
  conversationId: string,
  messageId: string       // assistant message id from the chat UI
}
```

**Flow:**
1. Verify Firebase auth token. 401 if missing.
2. Verify conversation belongs to user (check `conversations/{id}.userId === uid`). 403 otherwise.
3. Fetch the last **6** messages from the conversation (same pattern as chat) — gives the LLM context beyond just the single seed message.
4. Enforce daily quiz limit for free tier (5/day). 429 with `{ error: "quiz_daily_limit_exceeded" }` if exceeded.
5. Call LLM (DeepSeek for free, Claude for paid) with the generation prompt (see §6.1).
6. Parse the LLM output as JSON. If parsing fails, retry once with a stricter "respond with JSON only" instruction. If second parse fails, return 500 with `{ error: "quiz_generation_failed" }`.
7. Write the new quiz doc to `users/{uid}/quizzes/{quizId}` with `questions[].userAnswer = null` etc.
8. Log token usage to `users/{uid}/usage/{YYYY-MM}`.
9. Bump `users/{uid}/usage/{YYYY-MM-DD}.quizCount`.
10. Return `{ quizId, questions }` (only question text + choices, **never** `correctAnswer` or `explanation`).

**Response:**
```ts
{
  quizId: string,
  questions: Array<{
    id: string,
    type: "multiple_choice" | "open_ended",
    question: string,
    choices: string[] | null
  }>
}
```

**Edge cases:**
- Seed message is too short (< 50 chars) → return 400 with `{ error: "seed_too_short" }`. UI shows "Nepietiek satura, lai veidotu jautājumus."
- Seed message is a web-source-heavy answer (Path B) → still works; LLM gets text only.
- Conversation has been deleted between the button click and the API call → 404. UI gracefully hides the button.

### 5.2 `POST /api/quiz/answer`

**Input:**
```ts
{
  quizId: string,
  questionId: string,
  userAnswer: string      // trimmed, max 500 chars
}
```

**Flow:**
1. Auth check.
2. Fetch `users/{uid}/quizzes/{quizId}`. 404 if missing.
3. Find the question by `questionId`. Reject if `userAnswer` is already filled (prevents double submission).
4. Evaluate:
   - **Multiple choice:** exact match against `correctAnswer` (which is the chosen option's text). `wasCorrect = userAnswer === correctAnswer`. `explanation` is a short Latvian sentence stored server-side (see §6.2 for where it comes from).
   - **Open-ended:** call the LLM with the grading prompt (§6.2). Parse JSON `{ correct: boolean, explanation: string }`.
5. Update the question in the doc with `userAnswer`, `wasCorrect`, `explanation`.
6. If this was the last question (no remaining questions with `userAnswer === null`), set `completedAt` and compute `score = questions.filter(q => q.wasCorrect).length`.
7. Log tokens (open-ended only).
8. Return `{ wasCorrect, explanation, isComplete, score? }`.

**Cost optimization:**
- For multiple choice, the `explanation` for both the correct answer and each wrong answer is generated **during quiz generation** (one LLM call, not N). Stored in the question doc under `explanation` (for correct) and `wrongExplanations: { [choice]: string }` (for wrong choices). Then `/answer` reads the explanation from Firestore without any LLM call.
- For open-ended, one LLM call per answer. Unavoidable.
- Result: a 5-question quiz with mostly MC costs **1 LLM call** (generation) instead of 6.

### 5.3 `GET /api/quiz/:quizId`

Returns the quiz for resume-on-refresh. Strips `correctAnswer` / `correctIndex` from unanswered questions.

### 5.4 `GET /api/quiz/history` *(nice-to-have, skip for MVP)*

Returns recent quizzes. Defer until users ask for it.

---

## 6. Prompts

### 6.1 Generation prompt (Latvian, with JSON mode)

File: `lib/quiz/prompts.ts`

```ts
export function buildQuizGenerationPrompt(params: {
  subject: string;
  grade: number;
  seedMessage: string;
  recentContext: string; // last 5 messages concatenated
  desiredCount: number;  // 3–5
}): { system: string; user: string } {
  const system = `Tu esi skolotājs Latvijas skolā, kas palīdz skolēnam pārbaudīt izpratni par tēmu.

UZDEVUMS:
Izveido ${params.desiredCount} jautājumus par nupat paskaidroto tēmu.

NOTEIKUMI:
- Jautājumi latviski.
- ${params.grade}. klases līmenis — ne pārāk grūti, ne pārāk viegli.
- Priekšmets: ${params.subject}.
- 70% multiple_choice, 30% open_ended (atklātais jautājums).
- Multiple choice: 4 varianti, tikai 1 pareizs, citi ticami bet nepareizi.
- Open-ended: īsa atbilde (1–10 vārdi), skaidri pareiza vai nepareiza.
- Katram jautājumam īsa paskaidrojuma teikums (1–2 teikumi), kāpēc pareizā atbilde ir pareiza.
- Multiple choice: katram nepareizam variantam īss paskaidrojums, kāpēc tas ir nepareizs.

ATBILDES FORMĀTS — TIKAI JSON, BEZ KOMENTĀRIEM:

{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "...",
      "choices": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "...",
      "wrongExplanations": { "B": "...", "C": "...", "D": "..." }
    },
    {
      "type": "open_ended",
      "question": "...",
      "correctAnswer": "...",
      "explanation": "..."
    }
  ]
}`;

  const user = `TĒMA (pēdējā AI atbilde):
${params.seedMessage}

SARUNAS KONTEKSTS:
${params.recentContext}

Izveido ${params.desiredCount} jautājumus JSON formātā.`;

  return { system, user };
}
```

**Parsing:** strip ```json``` fences if present, then `JSON.parse`. Validate with Zod. If Zod fails, retry with instruction "Iepriekšējā atbilde nebija derīgs JSON. Atgriez tikai JSON." Fail the request on second bad parse.

### 6.2 Open-ended grading prompt

```ts
export function buildOpenEndedGradingPrompt(params: {
  question: string;
  correctAnswer: string;
  userAnswer: string;
  subject: string;
  grade: number;
}): { system: string; user: string } {
  const system = `Tu esi iecietīgs skolotājs, kas vērtē skolēna īso atbildi.

Atzīsti atbildi par pareizu, ja skolēns ir trāpījis galveno ideju — arī tad, ja formulējums atšķiras, ja ir sīkas gramatikas kļūdas vai ja atbilde ir īsāka par gaidīto.

Atzīsti par nepareizu, ja atbilde ir tukša, nepareiza pēc būtības vai nav saistīta ar jautājumu.

ATBILDE — TIKAI JSON:
{ "correct": true | false, "explanation": "1–2 teikumi latviski" }`;

  const user = `JAUTĀJUMS: ${params.question}
PAREIZĀ ATBILDE: ${params.correctAnswer}
SKOLĒNA ATBILDE: ${params.userAnswer}

Novērtē.`;

  return { system, user };
}
```

---

## 7. Files to create

### Types
- `lib/quiz/types.ts` — `Quiz`, `Question`, `MultipleChoiceQuestion`, `OpenEndedQuestion`, request/response DTOs.

### Prompts & logic
- `lib/quiz/prompts.ts` — the two prompt builders.
- `lib/quiz/generate.ts` — calls the LLM, parses, validates, writes to Firestore. Exports `generateQuiz(uid, conversationId, messageId, tier)`.
- `lib/quiz/answer.ts` — evaluates one answer. Exports `answerQuestion(uid, quizId, questionId, userAnswer, tier)`.

### API routes
- `app/api/quiz/generate/route.ts` — `POST`.
- `app/api/quiz/answer/route.ts` — `POST`.
- `app/api/quiz/[id]/route.ts` — `GET`.

### UI
- `components/chat/QuizMeButton.tsx` — the pill button shown under latest assistant message.
- `components/chat/QuizPanel.tsx` — the inline expanded panel (container + state machine).
- `components/chat/QuizQuestionCard.tsx` — renders a single question (handles both MC and open-ended).
- `components/chat/QuizResultScreen.tsx` — final summary with score + expandable review list.
- `lib/context/quiz-context.tsx` *(optional)* — if the state gets complex, lift to context. Start without; inline `useReducer` in `QuizPanel.tsx` should be enough.

### Integration
- Modify `components/chat/ChatMessage.tsx`:
  - Accept a new prop `isLastAssistantMessage: boolean`.
  - When true AND `role === "assistant"`, render `<QuizMeButton />` next to `MessageFeedback` in the existing feedback row.
  - Accept `onQuizOpen: (messageId) => void` so the parent can track which quiz is active.
- Modify `components/chat/ChatContainer.tsx`:
  - Pass `isLastAssistantMessage` by comparing `msg.id` to the last assistant id in `messages`.
  - Manage one piece of state: `activeQuizForMessageId: string | null`. Renders `QuizPanel` under the message with that id.

### Tests (colocated)
- `components/chat/QuizPanel.test.tsx` — Vitest. Test state machine transitions: idle → loading → question(i) → result.
- `lib/quiz/generate.test.ts` — mock LLM client, test JSON parsing happy + malformed paths.
- `tests/quiz.e2e.ts` — Playwright. Full flow: send message → see button → start quiz → answer all → see result.

---

## 8. Component skeletons (for reference — not full code)

### `QuizMeButton.tsx`

```tsx
"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";

export function QuizMeButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-full bg-[#2563EB]/10 dark:bg-[#4F8EF7]/10 px-3 py-1 text-xs font-semibold text-[#2563EB] dark:text-[#4F8EF7] transition-all hover:bg-[#2563EB]/15 dark:hover:bg-[#4F8EF7]/20 disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label="Sākt pašpārbaudi"
    >
      <Sparkles className="h-3 w-3" />
      Pārbaudi mani
    </button>
  );
}
```

### `QuizPanel.tsx` state machine

```ts
type QuizState =
  | { phase: "idle" }
  | { phase: "loading_generation" }
  | { phase: "generation_error"; message: string }
  | { phase: "answering"; questionIndex: number; lastResult: AnswerResult | null }
  | { phase: "result"; score: number; total: number };
```

- Transitions driven by API responses.
- Persist `{ quizId, state }` to `sessionStorage` keyed by `conversationId`. Restore on mount.

### Styling rules

- Panel surface: `bg-white/50 dark:bg-[#1A2033]/50 border border-[#E5E7EB] dark:border-white/7 rounded-2xl p-4`
- Inherits conversation's subject accent color on the top border (2px).
- Correct state: `text-[#22C55E]` + check icon. Wrong: `text-[#F59E0B]` + warning icon (**not red** — softer tone).
- Each question transition: 200ms fade, 4px translate-up. No spring animations.

---

## 9. Observability & analytics events

Add these to the existing `logAnalyticsEvent` (Firebase Analytics) calls:

| Event | Params |
|-------|--------|
| `quiz_generated` | `subject, grade, tier, questionCount` |
| `quiz_answered` | `quizId, questionIndex, wasCorrect, type` |
| `quiz_completed` | `quizId, score, total, tier` |
| `quiz_generation_failed` | `tier, errorCode` |
| `quiz_daily_limit_hit` | `tier` (will be `free` in all cases) |

These drive the Phase-B decision on whether to promote quiz harder or leave it hidden behind the button.

---

## 10. Acceptance criteria

1. Clicking "Pārbaudi mani" on an assistant message produces a quiz in ≤ 5 s (p95) for paid tiers, ≤ 8 s for free tier (DeepSeek is sometimes slow).
2. All copy is in Latvian. No English leaks, not even in error toasts.
3. Student on a free account hits the daily quiz limit after 5 quizzes in one day — sees a clear upgrade prompt pointing to Pro.
4. Refreshing mid-quiz restores the quiz to the correct question index.
5. Question JSON from the LLM is validated — malformed output never crashes the UI.
6. Quiz panel works on mobile (375px width). Touch targets ≥ 44×44 px.
7. Dark mode matches existing surface contrast (see SkolnieksAI tokens in `globals.css`).
8. No new copyrighted content is reproduced — quiz generation only uses the already-generated assistant response + recent chat as context.

---

## 11. Rollout

1. Behind feature flag `NEXT_PUBLIC_QUIZ_ENABLED`. Default `false` in Vercel Production.
2. Ship backend + UI flag `false` → verify types + routes in preview deployment.
3. Local test with free + premium accounts.
4. Flip flag to `true` in Production.
5. Watch analytics for 48 h: generation error rate < 2%, completion rate > 50%.
6. If healthy, remove flag after 1 week.

---

## 12. Out of scope for this PR

- Quiz history page ("my past quizzes"). Deferred until students ask for it.
- Spaced repetition of missed questions (that's a Flashcards feature — link across via the "Izveidot kartītes no kļūdām" CTA on the result screen).
- Subject/topic-wide quizzes generated from scratch (no seed message). Future feature, separate spec.
- Image-based questions. Out of scope — no vision pipeline in this feature.
