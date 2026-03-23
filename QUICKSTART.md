# Quick Start

All commands run from the project root:

```bash
cd C:\Users\adria\.antigravity\SkolnieksAI
```

## 1. RAG server (Terminal 1)

```bash
.\skolnieksai-env\Scripts\activate
$env:RAG_API_KEY="c1476dae0bf9be6e8d439b7f1f61f2e338fc2d3b2838505cf2c07a751fc5511f"; uvicorn rag_server:app --port 8001 --reload

```

## 2. Next.js dev server (Terminal 2)

```bash
npm run dev
```

## URLs

- Frontend: http://localhost:3000
- RAG API: http://localhost:8001
