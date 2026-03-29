# Implementation Plan

Two features: secure password reset with a strict 5-minute token window, and locking the Claude AI model behind the `exam_prep` / `school_pro` tiers.

---

## Feature 1: Secure Password Reset (5-Minute Token)

### Context

Firebase's built-in `sendPasswordResetEmail` enforces a minimum 1-hour expiry (configurable only in Firebase Console, never below 1 hour). To guarantee a strict 5-minute window, we bypass Firebase's reset flow entirely and implement a custom token system: a server-generated secret is stored in Firestore with a hard `expiresAt` timestamp, emailed as a link, and consumed in a single-use transaction.

Resend is already in the stack (`RESEND_API_KEY` in `.env.example`) so no new dependencies are needed.

---

### Files to Create

| Path | Purpose |
|------|---------|
| `app/api/auth/forgot-password/route.ts` | Generate token, write to Firestore, send email via Resend |
| `app/api/auth/verify-reset-token/route.ts` | Validate token without consuming it (used on page load) |
| `app/api/auth/reset-password/route.ts` | Re-validate token, update password via Admin SDK, mark used |
| `app/(auth)/forgot-password/page.tsx` | Email input form |
| `app/(auth)/reset-password/page.tsx` | New password form |

### Files to Modify

| Path | Change |
|------|--------|
| `app/(auth)/login/page.tsx` | Add "Aizmirsi paroli?" link below the password field |
| `.env.example` | Already has `RESEND_API_KEY` — no change needed |

---

### Step-by-Step Implementation

#### Step 1 — Firestore token schema

Collection: `passwordResetTokens`
Document ID: the token hex string itself (fast lookup, no index needed)

```ts
interface PasswordResetToken {
  email: string;          // lowercase
  expiresAt: number;      // Date.now() + 5 * 60 * 1000
  used: boolean;          // false on create, true after successful reset
  createdAt: number;      // Date.now()
  ipAddress?: string;     // optional, for audit log
}
```

Security rules: deny all client-side reads and writes — this collection is only accessed from server-side Admin SDK.

---

#### Step 2 — `POST /api/auth/forgot-password`

**Input (Zod):**
```ts
z.object({ email: z.string().email() })
```

**Logic:**
1. Normalize email to lowercase.
2. Look up user with `adminAuth.getUserByEmail(email)`. If not found, **return `200 OK` with a generic success message** — never reveal whether an email is registered (prevents user enumeration).
3. Check if a non-expired, non-used token already exists for this email (query `passwordResetTokens` where `email == email && used == false && expiresAt > now`). If one exists that was created within the last 60 seconds, return the same generic success without creating a new one (rate-limit spam).
4. Generate token: `crypto.randomBytes(32).toString('hex')`.
5. Write to Firestore:
   ```ts
   adminDb.collection('passwordResetTokens').doc(token).set({
     email,
     expiresAt: Date.now() + 5 * 60 * 1000,
     used: false,
     createdAt: Date.now(),
   });
   ```
6. Build reset URL: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`
7. Send email via Resend SDK:
   ```ts
   await resend.emails.send({
     from: 'SkolnieksAI <noreply@yourdomain.com>',
     to: email,
     subject: 'Paroles atiestatīšana — SkolnieksAI',
     html: resetEmailTemplate(resetUrl),
   });
   ```
8. Return `{ success: true }`.

**Email template** (`lib/email/reset-template.ts`):
- Plain but clean HTML in Latvian.
- Large CTA button: "Atiestatīt paroli"
- Bold warning: "Šī saite ir derīga tikai **5 minūtes**."
- Footer note: "Ja tu nepieprasīji paroles maiņu, ignorē šo e-pastu."

**Error handling:**
- Resend failure → log error, still return `200` with generic success (don't expose mail errors to client).
- Firestore write failure → return `500`.

---

#### Step 3 — `GET /api/auth/verify-reset-token`

**Input:** `?token=<hex>`

**Logic:**
1. Read `adminDb.collection('passwordResetTokens').doc(token).get()`.
2. If doc doesn't exist → `{ valid: false, reason: 'not_found' }`.
3. If `used === true` → `{ valid: false, reason: 'used' }`.
4. If `expiresAt <= Date.now()` → `{ valid: false, reason: 'expired' }`.
5. Otherwise → `{ valid: true, email: maskedEmail(doc.email) }` (mask to e.g. `a***@gmail.com` for display).

**Note:** This endpoint only reads — it does not consume the token. The token is consumed only in step 4.

---

#### Step 4 — `POST /api/auth/reset-password`

**Input (Zod):**
```ts
z.object({
  token: z.string().min(64).max(64),
  password: z.string().min(8).max(128),
})
```

**Logic (Firestore transaction):**
1. Inside `adminDb.runTransaction`:
   a. Read the token document.
   b. Validate: exists, `!used`, `expiresAt > Date.now()`.
   c. If any check fails → throw, transaction aborts → return `400`.
   d. Update the document: `{ used: true }`.
2. Outside transaction: `adminAuth.getUserByEmail(doc.email)` → `adminAuth.updateUser(uid, { password })`.
3. Return `{ success: true }`.

**Why transaction?** Prevents a race condition where two simultaneous requests both read `used: false` before either writes `used: true`.

---

#### Step 5 — `app/(auth)/forgot-password/page.tsx`

**UI states:**

| State | What user sees |
|-------|---------------|
| `idle` | Email input + "Sūtīt saiti" button |
| `loading` | Button disabled with spinner |
| `success` | Green checkmark + "Ja šis e-pasts ir reģistrēts, saite tika nosūtīta. Pārbaudi savu iesūtni." No email is echoed back. |
| `error` | Red inline message for network/validation errors only |

**Behavior:**
- Client-side validation: `z.string().email()` before submitting.
- On success, always show the generic success message regardless of whether the email exists (same UX, no enumeration).
- "Atpakaļ uz pieteikšanos" link at the bottom.

---

#### Step 6 — `app/(auth)/reset-password/page.tsx`

**On mount (`useEffect`):**
1. Read `token` from `useSearchParams()`.
2. Call `GET /api/auth/verify-reset-token?token=...`.
3. Set state to `valid`, `expired`, `used`, or `not_found`.

**UI states:**

| State | What user sees |
|-------|---------------|
| `loading` (mount) | Spinner while verifying token |
| `expired` | "Saite ir beigusies. Lūdzu, pieprasi jaunu." + link to `/forgot-password` |
| `used` | "Šī saite jau tika izmantota. Piesakies ar jauno paroli." + link to `/login` |
| `not_found` | "Nederīga saite." + link to `/forgot-password` |
| `valid` | New password input + confirm password input + "Iestatīt jauno paroli" button |
| `submitting` | Button disabled with spinner |
| `success` | "Parole veiksmīgi nomainīta!" + auto-redirect to `/login` after 3 seconds |
| `submit_error` | Inline error (e.g., token expired between load and submit) |

**Password validation (client-side):**
- Min 8 characters.
- Passwords must match.
- Show strength indicator (optional, low priority).

---

#### Step 7 — Modify `app/(auth)/login/page.tsx`

Add a "Aizmirsi paroli?" (`<Link href="/forgot-password">`) text link positioned below the password field and above the submit button.

**Edge case:** Google-only accounts don't have a password. The forgot-password flow will still work — `adminAuth.updateUser` can set a password on a Google-linked account, effectively adding email/password as a second provider. This is acceptable behaviour and requires no special handling.

---

#### Edge Cases

| Scenario | Handling |
|----------|---------|
| User requests reset twice quickly | Second request within 60s reuses the same response without creating a new token |
| Token expires between page load and form submit | `POST /reset-password` re-validates inside a transaction → returns `400 { reason: 'expired' }` → UI shows error with link to request a new one |
| User navigates away and re-opens the link after 5 min | `GET /verify-reset-token` returns `expired` → form is never shown |
| Attacker tries to brute-force tokens | 64-char hex = 256-bit entropy. Firestore read on every guess. Add `NEXT_PUBLIC_APP_URL`-based CORS + rate-limit middleware if needed. |
| Email delivery fails | Server logs error, returns generic `200` — user is told to check their inbox; nothing is revealed |

---

### Verification

1. Sign up with email/password. Log out.
2. Go to `/login` → click "Aizmirsi paroli?" → verify redirect to `/forgot-password`.
3. Enter a non-existent email → confirm generic success message (no "not found" error).
4. Enter your real email → confirm email arrives within ~10 seconds.
5. Click the link → verify password form appears.
6. Wait 5+ minutes, then submit a new password → confirm "saite ir beigusies" error.
7. Request a new link → submit new password immediately → confirm success + redirect to `/login`.
8. Try the used link again → confirm "jau izmantota" error.

---

---

## Feature 2: Restrict Claude to exam_prep / school_pro Tiers

### Context

The chat API (`app/api/chat/route.ts:234-236`) already enforces model access server-side — free and `premium` tier requests for Claude are silently downgraded to DeepSeek. However, the UI currently lets any logged-in user select Claude in Settings, which creates a misleading experience. This change intercepts the click in the UI: free/premium users see the UpgradeModal instead of having their setting changed.

**Tier matrix:**

| Tier | DeepSeek | Claude (UI selectable) |
|------|----------|----------------------|
| `free` | ✓ | ✗ → UpgradeModal |
| `premium` | ✓ | ✗ → UpgradeModal |
| `exam_prep` | ✓ | ✓ |
| `school_pro` | ✓ | ✓ |

---

### Files to Modify

| Path | Change |
|------|--------|
| `components/settings/SettingsPanel.tsx` | Refactor `AiModelSection` to custom buttons; add UpgradeModal; import `useAuth` |
| `lib/context/settings-context.tsx` | Add `sanitizeSettings(settings, tier)` helper called on load to guard stale `claude` value |

### Files to Create

None — all changes are contained in existing files.

---

### Step-by-Step Implementation

#### Step 1 — Determine `canUseClaude` in `AiModelSection`

`AiModelSection` currently has no access to `profile`. Add `useAuth()`:

```ts
function AiModelSection() {
  const { settings, update } = useSettings();
  const { profile } = useAuth();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const canUseClaude =
    profile?.tier === 'exam_prep' || profile?.tier === 'school_pro';
  // ...
}
```

---

#### Step 2 — Replace `SegmentedControl` in `AiModelSection` with custom buttons

The shared `SegmentedControl` passes `onChange` directly and has no mechanism to intercept individual options. Replace only this instance with two custom `<button>` elements that replicate the visual style exactly, but route the Claude click through a gating function:

```tsx
<div className="flex rounded-xl bg-[#F3F4F6] dark:bg-[#1A2033]/50 p-1" role="radiogroup" aria-label="AI Modelis">
  {/* DeepSeek — always selectable */}
  <button
    role="radio"
    aria-checked={settings.aiModel === 'deepseek'}
    onClick={() => update('aiModel', 'deepseek')}
    className={/* same classes as SegmentedControl button */}
  >
    <span className="text-center leading-tight whitespace-pre-line">
      Standarta{'\n'}palīgs
    </span>
  </button>

  {/* Claude — gated */}
  <button
    role="radio"
    aria-checked={settings.aiModel === 'claude'}
    onClick={() => {
      if (canUseClaude) {
        update('aiModel', 'claude');
      } else {
        setShowUpgradeModal(true); // intercept: do NOT update settings
      }
    }}
    className={/* same classes; active only if canUseClaude && aiModel === 'claude' */}
  >
    <span className="text-center leading-tight whitespace-pre-line">
      Eksāmenu{'\n'}eksperts
      {!canUseClaude && (
        <span className="block text-[10px] font-normal opacity-80 mt-0.5">
          🔒 Premium
        </span>
      )}
    </span>
  </button>
</div>
```

**Visual rules:**
- The Claude button is never shown as "selected/active" for users where `canUseClaude === false`, even if `settings.aiModel === 'claude'` is stale in localStorage (see Step 3).
- The lock icon (`🔒`) and "Premium" sub-label appear only when `!canUseClaude`. They disappear for eligible tiers.
- Consider `opacity-60` on the Claude button when `!canUseClaude` so it visually reads as disabled without being `disabled` (which would prevent the click that opens the modal).

---

#### Step 3 — Mount `UpgradeModal` inside `AiModelSection`

`UpgradeModal` is already exported from `components/chat/UpgradeModal.tsx`. Import it into `SettingsPanel.tsx`:

```tsx
import { UpgradeModal } from '@/components/chat/UpgradeModal';

// Inside AiModelSection return:
<>
  {/* ...buttons... */}
  {showUpgradeModal && (
    <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
  )}
</>
```

Verify that `UpgradeModal` accepts an `onClose` prop (it does, per the existing implementation). The modal renders as a full-screen overlay so positioning within the drawer is not a concern.

---

#### Step 4 — Guard stale `claude` setting in `settings-context.tsx`

When a user's subscription expires, the Stripe webhook downgrades their tier to `free` in Firestore. Their `aiModel: 'claude'` setting may remain in localStorage until the browser clears it. Add a `sanitizeForTier` helper:

```ts
// In settings-context.tsx

function sanitizeForTier(
  s: Settings,
  tier: string | undefined
): Settings {
  const canUseClaude = tier === 'exam_prep' || tier === 'school_pro';
  if (!canUseClaude && s.aiModel === 'claude') {
    return { ...s, aiModel: 'deepseek' };
  }
  return s;
}
```

This function needs the `tier` from auth context. However, `settings-context.tsx` is currently auth-agnostic. Two options:

**Option A (recommended — simpler):** Apply the sanitize inside `AiModelSection` at render time. The display already handles it (Claude button never shows as selected for non-eligible users). Also call `update('aiModel', 'deepseek')` as a side-effect when `!canUseClaude && settings.aiModel === 'claude'`:

```ts
// In AiModelSection, after canUseClaude is determined:
useEffect(() => {
  if (!canUseClaude && settings.aiModel === 'claude') {
    update('aiModel', 'deepseek');
  }
}, [canUseClaude, settings.aiModel]);
```

This corrects localStorage the next time the settings panel is opened. The chat API already enforces the correct model server-side regardless, so there is no security gap.

**Option B:** Wrap `SettingsProvider` inside `AuthProvider` and pass tier as a prop to sanitize on load. This is a larger refactor and is not necessary given the server-side enforcement already in place.

Use Option A.

---

#### Step 5 — Confirm chat API fallback (no change needed)

`app/api/chat/route.ts:234-236` already contains:

```ts
const effectiveModel =
  tier === 'exam_prep' || tier === 'school_pro' ? model : 'deepseek';
```

This is the security backstop. Even if a client somehow sends `model: 'claude'`, non-eligible users get DeepSeek. No changes needed here.

---

#### Edge Cases

| Scenario | Handling |
|----------|---------|
| User on `exam_prep` selects Claude, then subscription expires | Stripe webhook → Firestore tier set to `free` → `useAuth` refreshes profile → `canUseClaude` becomes `false` → `useEffect` in `AiModelSection` sets `aiModel` back to `deepseek` in localStorage on next settings open. Chat API already used `effectiveModel` so no Claude calls were made after expiry. |
| User opens settings before auth profile loads (profile is `null`) | `canUseClaude` defaults to `false` (both conditions require a truthy tier). Claude is locked until profile loads. |
| User manually edits localStorage to set `aiModel: 'claude'` | Chat API enforces `effectiveModel` server-side — no Claude tokens are spent. |
| `UpgradeModal` opened from SettingsPanel — user upgrades via Stripe | Checkout redirects away; on return `profile` refreshes; `canUseClaude` becomes `true`; Claude button unlocks automatically. |
| `school_pro` tier (currently not sold but in codebase) | Already handled — `canUseClaude` is true for this tier. |

---

### Verification

1. Log in as a **free** user → open Settings → click "Eksāmenu eksperts":
   - Active selection does NOT change to Claude.
   - UpgradeModal appears.
   - Lock icon and "🔒 Premium" sub-label visible on the Claude button.
2. Close modal → confirm `settings.aiModel` is still `deepseek` (check localStorage).
3. Log in as a **premium** tier user → same test → same UpgradeModal behaviour.
4. Log in as an **exam_prep** user → click "Eksāmenu eksperts":
   - Active selection switches to Claude.
   - No modal appears.
   - No lock icon shown.
5. Simulate downgrade: manually set Firestore `users/{uid}/tier` to `free` while logged in as `exam_prep` → refresh profile → open Settings → confirm Claude button reverts to DeepSeek and lock icon reappears.
6. As a free user, send a chat message with `model: 'claude'` injected via devtools → confirm server response uses DeepSeek (check `X-Model-Used` response header or server logs).

---

## Summary of All Files Touched

| File | Feature | Action |
|------|---------|--------|
| `app/(auth)/login/page.tsx` | 1 | Add "Aizmirsi paroli?" link |
| `app/(auth)/forgot-password/page.tsx` | 1 | Create — email input form |
| `app/(auth)/reset-password/page.tsx` | 1 | Create — new password form |
| `app/api/auth/forgot-password/route.ts` | 1 | Create — generate token + send email |
| `app/api/auth/verify-reset-token/route.ts` | 1 | Create — validate token (non-consuming) |
| `app/api/auth/reset-password/route.ts` | 1 | Create — apply password + consume token |
| `lib/email/reset-template.ts` | 1 | Create — Latvian HTML email template |
| `components/settings/SettingsPanel.tsx` | 2 | Refactor `AiModelSection`, add UpgradeModal |
| `lib/context/settings-context.tsx` | 2 | No direct changes (sanitize via useEffect in component) |
| `app/api/chat/route.ts` | 2 | No changes needed — server enforcement already correct |
