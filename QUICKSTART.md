# Quick Start

All commands run from the project root:

```bash
cd C:\Users\adria\.antigravity\SkolnieksAI
```

## 1. RAG server (Terminal 1)

```bash
.\skolnieksai-env\Scripts\activate
uvicorn RAG_server:app --port 8001 --reload
```

## 2. Next.js dev server (Terminal 2)

```bash
npm run dev
```

## URLs

- Frontend: http://localhost:3000
- RAG API: http://localhost:8001
