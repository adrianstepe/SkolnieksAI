# Legal & GDPR — SkolnieksAI

## Company Registration

- Register SIA (Sabiedrība ar ierobežotu atbildību) before first B2B deal or live Stripe payments
- Entity: SIA "Stepe Digital" — cost ~€280
- Required for: Stripe live mode, school contracts, LIAA grant applications, invoicing

## GDPR Compliance (Latvia / EU)

### Age of Consent
- Latvia's digital age of consent: **13 years old** (per GDPR Article 8 + Latvian implementation)
- Users aged 13–17: can consent themselves
- Users under 13: **parental consent required** — must implement consent flow

### Under-13 Consent Flow — VPC (Verifiable Parental Consent)

Self-declaration (checkbox or parent-email-only) does not meet the GDPR "verifiable" standard
under DVI enforcement guidance. SkolnieksAI implements micro-payment verification:

#### Implementation

1. **Child signup** (`app/(auth)/signup/page.tsx`)
   - Birth year collected first. If `age < 13`, the account creation form is replaced by
     the parental consent form.
   - Child provides their name, email, and parent email. Password will be set later.
   - `POST /api/auth/parental-consent` stores a **pending** consent record in Firestore
     (`parentalConsents/{consentId}`) and emails the parent.

2. **Firestore schema** — `parentalConsents/{consentId}`
   ```
   childName:             string
   childEmail:            string
   parentEmail:           string
   birthYear:             number
   inviteCode?:           string
   status:                "pending" | "verified"
   createdAt:             Timestamp
   verifiedAt?:           Timestamp          (set on success)
   firebaseUid?:          string             (set on success)
   stripePaymentIntentId?: string            (set on success, audit trail)
   ```

3. **Parent verification page** (`app/parental-verify?token={consentId}`)
   - Explains the €0.01 verification to the parent.
   - Calls `POST /api/auth/parental-consent/create-intent` → Stripe PaymentIntent for €0.01.
   - Stripe Elements card form confirms the payment (handles SCA/3DS).
   - On success calls `POST /api/auth/parental-consent/verify`.

4. **Verify endpoint** (`app/api/auth/parental-consent/verify/route.ts`)
   - Retrieves the Stripe PaymentIntent and asserts `status === "succeeded"`.
   - Cross-checks `pi.metadata.consentId` to prevent replay attacks.
   - Creates Firebase Auth user (no password — account is passwordless until child sets one).
   - Creates Firestore `users/{uid}` with `parentConsent: true`, `parentEmail`, `stripePaymentIntentId`.
   - Marks `parentalConsents/{consentId}` as `verified`.
   - **Immediately refunds** the €0.01 via `stripe.refunds.create`.
   - Sends password-setup email to child via `adminAuth.generatePasswordResetLink` + Resend.

#### Why €0.01 micro-payment satisfies "verifiable"
- Requires a valid payment card in the parent's name — the same standard banks apply.
- Cards are age-gated (you cannot legally hold a debit/credit card under ~16 in Latvia).
- The charge + immediate refund creates an auditable record without ongoing cost.
- This approach is used by several EU ed-tech platforms pending eID mandate enforcement.

#### Alternative path — eParaksts / Smart-ID (post-launch TODO)
Latvia's national eID systems (eParaksts Mobile, Smart-ID) would provide stronger identity
assurance. Integration requires registration with a trust service provider (e.g. Dokobit,
Smart-ID Enterprise). A `// TODO` comment is left in the verify route for this.

#### Audit trail
- `stripePaymentIntentId` stored in both `users/{uid}` and `parentalConsents/{consentId}`
- Refund record visible in Stripe Dashboard
- `verifiedAt` timestamp for compliance reporting

### Data We Collect
| Data               | Purpose                    | Legal Basis     |
|---------------------|---------------------------|-----------------|
| Email               | Auth, account recovery     | Contract        |
| Display name        | Personalization            | Contract        |
| Grade level         | Content difficulty tuning  | Contract        |
| School (optional)   | B2B matching               | Legitimate int. |
| Chat messages       | Provide the service        | Contract        |
| Usage metrics       | Token budget enforcement   | Contract        |
| Payment info        | Billing (via Stripe)       | Contract        |

### Data NOT Stored
- No biometric data
- No location tracking
- No social media profiles
- No PII in ChromaDB (only curriculum content)

### Data Residency
- Firestore: **europe-west1** (Belgium) or **europe-west3** (Frankfurt)
- Vercel: Edge functions — EU region preferred
- ChromaDB: EU VPS (Hetzner, Germany)
- Stripe: EU data processing

### User Rights (GDPR Articles 15–22)
Must implement:
- [ ] Right to access: User can download their data
- [ ] Right to deletion: User can delete account + all data
- [ ] Right to rectification: User can edit profile
- [ ] Right to data portability: Export conversations as JSON
- [ ] Right to withdraw consent: Delete account button

### Privacy Policy
Required before launch. Must cover:
- What data is collected and why
- How AI processes queries (data sent to DeepSeek / Anthropic APIs)
- Data retention periods
- Third-party processors (Firebase/Google, Stripe, DeepSeek, Anthropic)
- Contact info for data protection inquiries
- Right to complain to DVI (Datu valsts inspekcija — Latvia's DPA)

### School Contracts (B2B)
- Require Data Processing Agreements (DPAs) with each school
- School acts as data controller, SkolnieksAI as processor
- DPA must specify: data types, processing purposes, security measures, sub-processors

## Skola2030 Content Usage

- **Framework PDFs**: OK to use now. They describe the curriculum framework — factual/structural content
- **VISC exam papers**: DO NOT ingest yet. Copyrighted assessment materials
- **Action**: Email IZM (Izglītības un zinātnes ministrija) + VISC same week payments go live
  - Frame as public-private partnership aligned with €33.4M ESF+ digital education initiative
  - Request: written permission to reference exam materials, potential collaboration

## LIAA AI Grant

- Available: up to €200,000 through LIAA (Latvijas Investīciju un attīstības aģentūra)
- Apply early — competitive, but SkolnieksAI fits the digital education innovation criteria
- Requirements: registered SIA, business plan, proof of concept
- Timeline: apply after soft launch with initial user metrics
