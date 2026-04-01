# SkolnieksAI — Future Ideas & Features

> These are post-launch ideas. Do not implement before Phase 6 ships and revenue exists.

---

## Phase 8 — Revision Pages

Interactive topic pages per Skola2030 exam subject. Each page has:
- Short AI-generated summary (from RAG)
- Interactive simulation (sliders, graphs, periodic table reactions etc.)
- Curated YouTube embed (Latvian first, English fallback)
- "Jautāt AI" button that opens chat pre-seeded with that topic

Tier gating:
- Bezmaksas → summary + YouTube only
- Pro → + basic interactives
- Premium → + AI-generated mock exam questions per topic

Build order: template first → map all Skola2030 topics → generate summaries via RAG → build interactives only for highest-yield subjects first (Matemātika, Fizika, Ķīmija).

Scope: ~7 subjects × ~10 topics = ~70–100 pages minimum.

---

## Phase 8 — Flashcards

Student can generate flashcards from any chat topic or subject. AI generates question/answer pairs from the RAG content. Student flips through them, marks known/unknown, and weak cards resurface.

Tier gating:
- Bezmaksas → up to 20 flashcard decks saved
- Pro → unlimited decks
- Premium → spaced repetition algorithm (weak cards resurface automatically)

---

## Phase 9 — Notes Photo → AI Revision (Long Term)

Student uploads a photo of their handwritten or printed notes. AI:
1. Reads and explains the content
2. Identifies gaps or misconceptions
3. Generates practice questions based on the notes
4. Student must answer correctly to similar questions before moving on (mastery-based progression)

This is essentially a personal tutor from a photo. Requires vision model (Claude Sonnet) — image uploads are costly so gate behind Premium only.

Dependencies: vision support in chat must ship first (planned as Premium feature post-launch).

---

## Notes

- Revision pages and flashcards depend on RAG gaps being filled first (Latviešu valoda, Latvijas vēsture, civic subjects)
- Notes photo feature depends on camera/image upload being enabled in chat
- All three features should be validated by user request data before building — check which subjects students ask about most in the first 30 days post-launch
