# 🎓 SkolnieksAI

**Latvijas pirmais AI mācību palīgs** — Latvia's first AI study companion, aligned to the national Skola2030 curriculum.

Built for 110–120k students in grades 6–12 across 553 Latvian schools.

## What It Does

Students ask questions in Latvian → SkolnieksAI retrieves relevant Skola2030 curriculum content → generates accurate, curriculum-aligned answers → helps students *understand*, not copy.

## Tech Stack

| Layer        | Tech                                      |
|--------------|-------------------------------------------|
| Frontend     | Next.js 14 (App Router) + Tailwind CSS    |
| Hosting      | Vercel                                    |
| Auth         | Firebase Auth (email + Google)            |
| Database     | Firestore                                |
| Vector DB    | ChromaDB + sentence-transformers          |
| RAG          | LangChain + pdfplumber                    |
| Free AI      | DeepSeek V3.2                             |
| Premium AI   | Claude Sonnet 4.6                         |
| Payments     | Stripe                                    |

## Getting Started

```bash
# Clone
git clone https://github.com/stepe-digital/skolnieks-ai.git
cd skolnieks-ai

# Install
npm install

# Environment
cp .env.example .env.local
# Fill in your API keys

# Start ChromaDB
docker compose up chroma -d

# Ingest curriculum PDFs
npm run ingest

# Dev server
npm run dev
```

## Project Structure

See [CLAUDE.md](./CLAUDE.md) for full architecture and `docs/` for detailed documentation.

## License

Proprietary — Stepe Digital. All rights reserved.
