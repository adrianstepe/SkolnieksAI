# Password Reset (5-min Token Flow)

## Overview
Custom reset flow: server generates a short-lived token → stored in Firestore → emailed as a link → user submits new password → Admin SDK applies it.

## Flow

```
1. User submits email on /forgot-password
   POST /api/auth/forgot-password
   → crypto.randomBytes(32) token
   → Firestore: { email, token, expiresAt: now+5min, used: false }
   → Send email with link: /reset-password?token=<token>

2. User opens link → /reset-password?token=...
   GET /api/auth/verify-reset-token?token=...
   → Read Firestore doc, check !used && expiresAt > now
   → Return { valid, email }

3. User submits new password
   POST /api/auth/reset-password
   → Re-verify token in Firestore
   → adminAuth.getUserByEmail(email) → adminAuth.updateUser(uid, { password })
   → Mark token used: true in Firestore
```

## Files to Create

| Path | Purpose |
|------|---------|
| `app/api/auth/forgot-password/route.ts` | Generate & email token |
| `app/api/auth/verify-reset-token/route.ts` | Check token validity |
| `app/api/auth/reset-password/route.ts` | Apply new password |
| `app/(auth)/forgot-password/page.tsx` | Email input form |
| `app/(auth)/reset-password/page.tsx` | New password form |

## Modify

- `app/(auth)/login/page.tsx` — add "Forgot password?" link
- `.env.local` — add SMTP vars (see below)

## Dependencies

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

## .env.local additions

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-google-app-password
SMTP_FROM="SkolnieksAI <your-gmail@gmail.com>"
```

> **Gmail App Password**: Google Account → Security → 2-Step Verification → App passwords → create "SkolnieksAI".

## Notes
- Token lives in Firestore collection `passwordResetTokens/{token}`
- Re-verify on every step (token could expire between steps)
- Delete (or mark `used: true`) after successful reset to prevent reuse
