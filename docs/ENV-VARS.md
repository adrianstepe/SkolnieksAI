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

# --- ChromaDB (Chroma Cloud) ---
CHROMA_API_KEY=...                   # Chroma Cloud API key
CHROMA_TENANT=...                    # Chroma Cloud tenant name
CHROMA_DATABASE=skolnieksai          # Chroma Cloud database (default: skolnieksai)
```

## Required for Production

```bash
# --- Stripe ---
STRIPE_SECRET_KEY=sk_live_...        # Live mode secret key
STRIPE_WEBHOOK_SECRET=whsec_...      # Webhook endpoint signing secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # Client-side
STRIPE_PRICE_PRO=price_...           # Stripe Price ID — Pro, monthly (server-side only)
STRIPE_PRICE_PREMIUM=price_...       # Stripe Price ID — Premium, monthly (server-side only)
STRIPE_PRO_ANNUAL_PRICE_ID=price_...    # Pro yearly price (e.g. €59.99/yr) — server-side only
STRIPE_PREMIUM_ANNUAL_PRICE_ID=price_... # Premium yearly price (e.g. €143.99/yr) — server-side only

# --- Anthropic (paid tier) ---
ANTHROPIC_API_KEY=sk-ant-...         # Claude API key for premium users

# --- Transactional Email ---
RESEND_API_KEY=re_...                # Resend API key (resend.com)
                                     # Free tier: 3 000 emails/month, 100/day
                                     # Verify skolnieks.ai as sending domain first

# --- Cron Security ---
CRON_SECRET=...                      # Random hex secret for Vercel Cron auth
                                     # Generate: openssl rand -hex 32
                                     # Vercel sends this as: Authorization: Bearer <secret>

# --- Rate Limiting (Upstash Redis) ---
UPSTASH_REDIS_REST_URL=...           # Upstash Redis REST URL (edge rate limiter)
UPSTASH_REDIS_REST_TOKEN=...         # Upstash Redis REST token
                                     # Create at console.upstash.com → New Database → REST API
                                     # Middleware fails-open if these are missing (Firestore daily
                                     # caps remain as the backstop)

# --- Admin Dashboard ---
ADMIN_USERNAME=...                   # Admin login username
ADMIN_PASSWORD=...                   # Admin login password
ADMIN_SESSION_SECRET=...             # Random hex secret for admin session cookie
                                     # Generate: openssl rand -hex 32

# --- App Config ---
NEXT_PUBLIC_APP_URL=https://skolnieks.ai  # Production URL
NODE_ENV=production
```

## Optional

```bash
# --- Analytics ---
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=skolnieks.ai  # If using Plausible

# --- Embedding Model ---
EMBEDDING_MODEL=paraphrase-multilingual-MiniLM-L12-v2    # Sentence-transformers model name
```

## Stripe Test Mode (Development)

Use Stripe test keys during development:
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

## RAG Server (rag_server.py)

```bash
# --- RAG API ---
RAG_API_KEY=...                      # Secret key for X-API-Key header auth on all RAG endpoints
                                     # Generate: openssl rand -hex 32

ALLOWED_ORIGINS=https://skolnieksai.lv,https://www.skolnieksai.lv
                                     # Comma-separated list of allowed CORS origins
                                     # Dev default: http://localhost:3000
                                     # NEVER set to * in production — credentials not allowed with wildcard
```

## Notes

- `NEXT_PUBLIC_*` vars are exposed to the browser — only put non-sensitive config here
- Firebase client config (`NEXT_PUBLIC_FIREBASE_*`) is safe to expose by design
- `FIREBASE_SERVICE_ACCOUNT_KEY` must stay server-side only
- For Vercel deployment: add all vars in Project Settings → Environment Variables
