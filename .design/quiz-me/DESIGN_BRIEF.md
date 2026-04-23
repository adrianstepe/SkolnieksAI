# Design Brief: Quiz Me Mode

## Problem

A student reads an AI explanation and thinks they understood it — then closes the tab and forgets everything within the hour. There's no moment of friction that forces comprehension to consolidate. The chat feels passive: receive, scroll, move on. Students have no way to know whether they actually understood, or just followed along.

## Solution

A self-check mode that lives inside the chat flow. After any AI response, a subtle pill button appears below the message. One tap generates 5 questions from that specific explanation. The student answers one at a time, gets immediate feedback with a short Latvian explanation, and sees a final score. The whole experience happens inline — no navigation, no modal, no exam anxiety. It feels like the AI asking "wait, do you actually get this?" in a friendly way.

## Experience Principles

1. **Belonging over separation** — The quiz panel is part of the conversation, not a layer on top of it. It uses the same surface language (card, border, spacing) as the chat. Students should not feel like they "left" the chat.

2. **Encouragement over judgment** — Wrong answers get amber, not red. Copy is always softened ("Ne gluži." not "Nepareizi!"). The score screen celebrates effort at every level. The tone is a friendly classmate, not an examiner.

3. **Zero-friction entry, complete-state exit** — Starting a quiz is one tap. Finishing it shows everything: score, all questions reviewed, explanations revealed. The student leaves with more information than they arrived with, never less.

## Aesthetic Direction

- **Philosophy**: Calm Utility — functional density without visual noise. The quiz panel should feel like a natural extension of the chat surface, not a new product dropped into the page.
- **Tone**: Warm, low-stakes, encouraging. Like a study partner who genuinely wants you to get it right.
- **Reference points**: Duolingo's answer feedback cadence (immediate, clear, non-punitive). Linear's inline panels (same surface language as the rest of the UI). The existing SkolnieksAI chat bubble aesthetic.
- **Anti-references**: Google Forms (clinical, exam-like). Kahoot (gamified noise, anxiety-inducing countdown). Any UI with red X marks as primary feedback.

## Existing Patterns

- **Typography**: DM Sans for body text, Sora for headings, JetBrains Mono for code. Font sizes via Tailwind (`text-sm`, `text-xs`, `text-base`).
- **Colors**: Dark theme. Base `#0F1117`, surface `#1A2033`, border `rgba(255,255,255,0.07)`. Primary `#4F8EF7`. Subject accents via `--color-subj-{subject}` CSS vars (12 subjects). Correct: `#22C55E`. Wrong: `#F59E0B` (amber — never red in quiz context).
- **Spacing**: Tailwind scale. Chat messages use `p-4`, `rounded-2xl`, `gap-3`.
- **Components to extend**:
  - `ChatMessage.tsx` — receives new `quizSlot?: React.ReactNode` prop, renders below the feedback row.
  - `ChatContainer.tsx` — owns `activeQuizForMessageId: string | null` state, tracks last assistant message id.
  - `UpgradeModal` — reused on 429 quiz limit response.
  - `MessageFeedback` — existing feedback row is the visual anchor point for the `QuizMeButton`.

## Component Inventory

| Component | Status | Notes |
|---|---|---|
| `QuizMeButton` | New | Pill button. Shown only on latest assistant message. Uses `--color-primary` tint. Renders in the existing feedback row next to thumbs up/down. |
| `QuizPanel` | New | Inline card below the message bubble. Contains state machine: `idle → loading → answering(n) → result`. |
| `QuizQuestionCard` | New | Renders one question. Two variants: multiple choice (4 tappable option cards) and open-ended (text input + submit). |
| `QuizResultScreen` | New | Final summary. Big score, friendly headline, collapsed question review list, "Aizvērt" button. |
| `ChatMessage` | Modify | Add `quizSlot?: React.ReactNode` and `isLastAssistantMessage: boolean` props. |
| `ChatContainer` | Modify | Track `activeQuizForMessageId`, pass `isLastAssistantMessage` to each message, render `QuizPanel` as the slot. |
| `UpgradeModal` | Exists | Triggered on 429 from `/api/quiz/generate`. No modifications needed. |

## Key Interactions

**Starting a quiz:**
Student sees `🎯 Pārbaudi mani` pill in the feedback row of the latest assistant message. Taps it. Panel expands below the bubble with a 200ms fade + 4px translate-up. Panel shows loading skeleton while `/api/quiz/generate` resolves. On success, first question appears.

**Answering (multiple choice):**
4 option cards displayed. Student taps one. Card highlights immediately (optimistic). POST to `/api/quiz/answer`. On response: correct card turns green with ✓, selected wrong card turns amber with ✗. Short Latvian explanation appears below. "Nākamais" button appears. Progress indicator `2/5` updates.

**Answering (open-ended):**
Single-line input with "Pārbaudīt" button. Enter key submits. Loading state on the button while grading. Feedback appears below the input inline — no card flip, no separate screen. Same green/amber pattern.

**New message while quiz is open:**
Quiz stays open at current question. The `QuizMeButton` pill disappears from the old message and appears on the new latest assistant message. No interruption to the active quiz.

**Result screen:**
Score displayed large. Headline varies by score (5/5 = "Perfekti! 🎉", 3–4 = "Labs darbs! 💪", 0–2 = "Jāmācās vēl drusku — tas ir OK!"). Each question collapsed, tappable to expand answer + explanation. Single "Aizvērt" button closes the panel. "Izveidot kartītes" button is **hidden** until Flashcards feature ships.

**Page refresh mid-quiz:**
On mount, QuizPanel checks sessionStorage for `{ quizId }` keyed by `conversationId`. If found, calls `GET /api/quiz/:quizId`. Server response strips `correctAnswer` from unanswered questions. Panel restores to the correct question index based on first unanswered question in the array.

**Daily limit hit (free tier):**
`/api/quiz/generate` returns 429. UpgradeModal opens. Same flow as chat limit.

## Responsive Behavior

- **Desktop**: Panel inherits the chat column max-width (user-configurable via SettingsPanel, typically 680–780px). Option cards in a 2×2 grid at ≥480px.
- **Mobile (375px)**: Option cards stack to full width, one per row. All touch targets minimum 44×44px — option cards use `min-h-[44px]` and `py-3`. Input row stacks vertically (input full-width, button below at full-width). Panel padding reduces to `p-3`.
- **The QuizMeButton** stays in the feedback row at all breakpoints. At 375px it fits alongside the thumbs buttons (small pill, `text-xs`).

## Accessibility Requirements

- All interactive elements keyboard-navigable. Tab order: option cards 1→4, or input → submit button.
- Option cards use `role="radio"` within a `role="radiogroup"`. Selected state communicated via `aria-checked`.
- Correct/wrong feedback announced via `aria-live="polite"` region — screen readers hear the explanation without visual-only reliance on color.
- Open-ended input has visible label (question text acts as label, `aria-labelledby`).
- "Pārbaudi mani" button has `aria-label="Sākt pašpārbaudi"`.
- Minimum contrast: text on surface cards must meet WCAG AA (4.5:1). Green `#22C55E` and amber `#F59E0B` on dark `#1A2033` both pass.
- Focus ring: consistent with existing site focus styles (Tailwind `focus-visible:ring-2 ring-[#4F8EF7]`).

## Out of Scope

- Quiz history page ("my past quizzes"). Deferred.
- "Izveidot kartītes" flow. Hidden until Flashcards feature ships.
- Subject/topic-wide quizzes without a seed message. Separate feature.
- Image-based questions. No vision pipeline.
- Quiz retake (same quiz, replay). Not in MVP.
- Spaced repetition of missed questions. Flashcards feature.
- `GET /api/quiz/history` endpoint. Deferred.
- Any animation beyond 200ms fade + 4px translate. No springs, no bounces.
