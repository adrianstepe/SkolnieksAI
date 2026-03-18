# Environment Variables — SkolnieksAI

Copy `.env.example` to `.env.local` for development. **NEVER** commit `.env.local`.

## Required for Development

```bash
# --- LLM APIs ---
DEEPSEEK_API_KEY=sk-...              # DeepSeek platform API key
DEEPSEEK_BASE_URL=https://api.deepseek.com  # Default, rarely changes

# --- Firebase ---
NEXT_PUBLIC_FIREBASE_API_KEY=...     # Client-side (safe to expose)
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=... # projectId.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...  # Your Firebase project ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

FIREBASE_SERVICE_ACCOUNT_KEY=...     # Server-side ONLY. JSON string of service account
                                     # Or use GOOGLE_APPLICATION_CREDENTIALS path

# --- ChromaDB ---
CHROMA_URL=http://localhost:8000     # Local dev ChromaDB instance
CHROMA_COLLECTION=skola2030_chunks   # Collection name
```

## Required for Production

```bash
# --- Stripe ---
STRIPE_SECRET_KEY=sk_live_...        # Live mode secret key
STRIPE_WEBHOOK_SECRET=whsec_...      # Webhook endpoint signing secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # Client-side

# --- Anthropic (paid tier) ---
ANTHROPIC_API_KEY=sk-ant-...         # Claude API key for premium users

# --- App Config ---
NEXT_PUBLIC_APP_URL=https://skolnieks.ai  # Production URL
NODE_ENV=production
```

## Optional

```bash
# --- Analytics ---
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=skolnieks.ai  # If using Plausible

# --- Rate Limiting ---
UPSTASH_REDIS_REST_URL=...           # If using Upstash for rate limiting
UPSTASH_REDIS_REST_TOKEN=...

# --- Embedding Model ---
EMBEDDING_MODEL=all-MiniLM-L6-v2    # Sentence-transformers model name
```

## Stripe Test Mode (Development)

Use Stripe test keys during development:
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

## Notes

- `NEXT_PUBLIC_*` vars are exposed to the browser — only put non-sensitive config here
- Firebase client config (`NEXT_PUBLIC_FIREBASE_*`) is safe to expose by design
- `FIREBASE_SERVICE_ACCOUNT_KEY` must stay server-side only
- For Vercel deployment: add all vars in Project Settings → Environment Variables
