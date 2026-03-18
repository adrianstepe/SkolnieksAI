# Deploy

Pre-deploy checklist and deployment flow.

## Pre-Deploy Checklist

1. `npm run lint` — zero errors
2. `npm run test` — all unit tests pass
3. `npm run build` — clean production build
4. `npm run test:e2e` — Playwright passes
5. New env vars documented in `docs/ENV-VARS.md`?
6. Firestore rules updated if data model changed?
7. Stripe webhook signature validation present?
8. No stray `console.log` in production code
9. All UI text in Latvian?

## Deploy

```bash
git status                    # clean working tree
npm run lint && npm run test && npm run build
git push origin main          # Vercel auto-deploys
curl https://skolnieks.ai/api/health  # smoke test
```

## Rollback

```bash
vercel rollback               # instant previous deployment
# or: git revert HEAD && git push origin main
```

## Post-Deploy

- Vercel Analytics: check error spikes
- Stripe dashboard: webhook delivery status
- DeepSeek/Claude usage dashboards: cost check
