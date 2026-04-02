# Deployment — SkolnieksAI

## Vercel (Frontend + API)

### Setup

1. Connect GitHub repo to Vercel.
2. Framework preset: Next.js.
3. Root directory: `/` (default).
4. Build command: `npm run build`.
5. Output directory: `.next` (default).

### Environment Variables (Vercel Dashboard)

Add all vars from `.env.local` to Vercel project settings. Mark `NEXT_PUBLIC_*` vars as available to client.

### Edge Runtime

Chat API route uses Edge Runtime for streaming. Verify `export const runtime = 'edge';` in `src/app/api/chat/route.ts`.

### Domain

- Initial: `skolnieks-ai.vercel.app` (free subdomain)
- Production: `skolnieks.ai` (purchase when revenue justifies it)

### Budget

Vercel free tier (Hobby): 100GB bandwidth, 100 hours Edge Function execution. More than enough for MVP soft launch.

## Firebase

### Project Setup

1. Create Firebase project: `skolnieks-ai-prod`.
2. Enable Authentication → Email/Password + Google sign-in.
3. Enable Cloud Firestore → Start in production mode.
4. Region: `europe-west1` (Belgium — closest to Latvia with Firestore support).

### Service Account Key

1. Firebase Console → Project Settings → Service Accounts → Generate New Private Key.
2. Download JSON → stringify → set as `FIREBASE_SERVICE_ACCOUNT_KEY` env var.

### Client Config

1. Firebase Console → Project Settings → General → Your Apps → Add Web App.
2. Copy the config object → stringify → set as `NEXT_PUBLIC_FIREBASE_CONFIG` env var.

### Firestore Indexes

Deploy indexes from `firestore.indexes.json`:

```bash
firebase deploy --only firestore:indexes
```

### Security Rules

Deploy rules from `firestore.rules`:

```bash
firebase deploy --only firestore:rules
```

### Budget

Firebase free tier (Spark): 1GB Firestore storage, 50K reads/day, 20K writes/day. Upgrade to Blaze (pay-as-you-go) when nearing limits — cost will be <€5/mo at early scale.

## ChromaDB

### Development

```bash
docker run -d --name chromadb \
  -p 8000:8000 \
  -v chroma-data:/chroma/chroma \
  chromadb/chroma:latest
```

### Production (Cheapest Options)

**Option 1: Railway.app ($5/mo)**
```bash
# railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile.chroma"

[deploy]
startCommand = "chroma run --host 0.0.0.0 --port 8000 --path /data"
```

Add persistent volume mounted at `/data`.

**Option 2: Hetzner VPS (€4.50/mo)**
- CX22: 2 vCPU, 4GB RAM, 40GB SSD.
- Run ChromaDB + sentence-transformers model for embedding.
- Set up with Docker Compose + Caddy reverse proxy.
- Secure with IP allowlisting (only Vercel's IPs).

**Option 3: Fly.io (~$3-5/mo)**
- Similar to Railway, with persistent volumes.
- Deploy via `fly launch` with Dockerfile.

### Connectivity

ChromaDB must be reachable from Vercel Edge Functions. Options:
1. Public URL with auth token header.
2. Railway/Fly private networking (if Vercel supports it — check).
3. Hetzner with Caddy + Bearer token auth.

Set `CHROMA_HOST` to the production URL.

## Resend (Transactional Email)

SkolnieksAI uses [Resend](https://resend.com) for all transactional email (password reset, parental consent).

### Requirements

- A verified **sending domain**: `send.skolnieksai.lv` — add the DNS records Resend provides (SPF, DKIM, DMARC) via your DNS provider.
- `RESEND_API_KEY` — generate in the Resend dashboard and add to your environment variables.

### Setup

1. Sign up at resend.com.
2. Add domain → `send.skolnieksai.lv` → follow the DNS verification steps.
3. Once verified, create an API key and set `RESEND_API_KEY` in `.env.local` (and in Vercel / Coolify project settings for production).
4. All emails are sent `from: "SkolnieksAI <noreply@send.skolnieksai.lv>"`.

> **Note:** Without `RESEND_API_KEY` the parental-consent endpoint returns `503 email_unavailable`. The password-reset flow will throw at startup. Both are hard failures by design — transactional email is required for GDPR-compliant onboarding.

## Stripe

### Setup

1. Create Stripe account (stripe.com).
2. Get API keys from Dashboard → Developers → API keys.
3. Create Products + Prices:
   - Premium: €5.99/month recurring
   - Exam Prep: €14.99/month recurring
   - School Pro: €20/student/year recurring (custom quantity)

### Webhook Setup

1. Stripe Dashboard → Developers → Webhooks → Add endpoint.
2. URL: `https://skolnieks-ai.vercel.app/api/webhooks/stripe`.
3. Events to listen: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`, `customer.subscription.updated`.
4. Copy signing secret → set as `STRIPE_WEBHOOK_SECRET`.

### Dev Testing

```bash
# Install Stripe CLI
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy webhook signing secret from CLI output
```

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`):

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

Vercel handles deployment automatically on push to `main`.

## Monitoring

- **Vercel Analytics**: Free tier includes Web Vitals + basic analytics.
- **Sentry**: Free tier for error tracking. Add `@sentry/nextjs`.
- **Firestore Console**: Monitor reads/writes to stay under limits.
- **Stripe Dashboard**: Monitor subscriptions and revenue.

## Before Deployment

The current dev/testing setup runs on **Vercel (free tier)** with a **local ChromaDB** instance. This is intentional for the MVP phase — it keeps costs at zero and lets you iterate fast.

**However, before going live** (defined as: first paying user OR Skola2030 license obtained), the stack must be migrated to **Hetzner VPS + Coolify** for hosting, with **Chroma Cloud** replacing the local vector DB. Reasons:

- Vercel Hobby has no SLA and bans commercial use without a paid plan
- Local ChromaDB is tied to a dev machine — it does not survive a Vercel deployment
- Hetzner (EU region) + Chroma Cloud satisfies GDPR data residency requirements
- Coolify gives you full deployment control, zero vendor lock-in, and costs ~€14/mo total

Do these two checklists in order. Checklist 1 can be done while still on Vercel. Checklist 2 is the actual cutover.

---

### Checklist 1 — Chroma Cloud setup (do this before go-live, while still on Vercel)

- [ ] Sign up for Chroma Cloud at trychroma.com and create a database called `skolnieksai`
- [ ] Copy `CHROMA_HOST`, `CHROMA_API_KEY`, `CHROMA_TENANT`, `CHROMA_DATABASE` from the Chroma Cloud dashboard
- [ ] Add the Chroma Cloud env vars to `.env.local` and test that the RAG pipeline works against Chroma Cloud
- [ ] Run the PDF ingestion script against Chroma Cloud to populate the hosted vector DB (`npm run ingest`)
- [ ] Verify queries return correct Skola2030 results from Chroma Cloud (not local DB)
- [ ] Update `.env.example` with all Chroma Cloud variable names and descriptions

---

### Checklist 2 — Hetzner + Coolify migration (do this at go-live)

- [ ] Create a Hetzner account at hetzner.com
- [ ] Spin up a **CX32** (4 vCPU, 8 GB RAM, 80 GB SSD, Ubuntu 24.04) in a EU region (Finland or Germany — closest to Latvia, GDPR compliant)
- [ ] SSH into the VPS and install Coolify using their one-line installer (docs at coolify.io)
- [ ] Connect the GitHub repo to Coolify
- [ ] Add ALL environment variables to the Coolify dashboard (Firebase, Stripe, DeepSeek, Anthropic, Chroma Cloud — mirror everything in `.env.example`)
- [ ] Add Cloudflare as a free CDN/DDoS layer in front of the VPS IP (cloudflare.com, free plan)
- [ ] Point the domain DNS A record to the Hetzner VPS IP (via Cloudflare)
- [ ] Add the domain in Coolify and let it provision the SSL certificate automatically
- [ ] Trigger the first deployment and verify it succeeds
- [ ] Verify the RAG pipeline can reach Chroma Cloud from the VPS
- [ ] Verify Firebase Auth, Firestore, and Stripe all work in production
- [ ] Verify `RESEND_API_KEY` and the `send.skolnieksai.lv` domain are configured in production (see Resend section above) — parental consent and password reset emails depend on this
- [ ] Switch Stripe from test mode to live mode
- [ ] Remove the Vercel project (optional — keep it a few days as a fallback before deleting)
