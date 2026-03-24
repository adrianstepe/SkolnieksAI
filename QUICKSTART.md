# Quick Start

All commands run from the project root:

```bash
cd C:\Users\adria\.antigravity\SkolnieksAI
```

## 1. RAG server (Terminal 1)

```bash
.\skolnieksai-env\Scripts\activate
$env:RAG_API_KEY="c1476dae0bf9be6e8d439b7f1f61f2e338fc2d3b2838505cf2c07a751fc5511f"; uvicorn RAG_server:app --port 8001 --reload

```

## 2. Next.js dev server (Terminal 2)

```bash
npm run dev
```

## URLs

- Frontend: http://localhost:3000
- RAG API: http://localhost:8001

Modified Files
Overview page → now an async server component fetching real Firestore numbers
AdminSidebar → Database / "RAG / Knowledge" replaced with FlaskConical / "RAG Tester"
Adding more dashboard tools later
Two steps: create app/(dev)/admin-dashboard/<name>/page.tsx, add an entry to the NAV_ITEMS array in AdminSidebar.tsx. The layout and auth middleware wrap everything automatically.

Note: The analytics totalMessages count requires a Firestore Collection Group index on the messages subcollection. If it doesn't exist yet, it gracefully falls back to 0 / N/A.