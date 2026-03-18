# Legal & Compliance — SkolnieksAI

## Content Licensing

### Skola2030 Curriculum Framework PDFs — CLEARED

The Skola2030 curriculum framework documents are publicly available educational standards published by the Latvian government. Using these as RAG context (retrieving relevant passages to inform AI responses) is permitted. We are not republishing the documents — we are using them as reference material.

### VISC Exam Papers — DO NOT USE

VISC (Valsts izglītības satura centrs) exam papers are copyrighted and their reproduction/use requires explicit permission. **Do not ingest, store, or reference VISC exam content** until written permission is obtained.

**Action item:** Email IZM (Ministry of Education) + VISC the same week Stripe payments go live. Frame as a public-private partnership opportunity aligned with Latvia's €33.4M ESF+ digital education initiative. Draft in `docs/templates/izm-email-draft.md`.

## GDPR Compliance

### Applicable Law

Latvia follows EU GDPR. Key requirements for SkolnieksAI:

### Age of Digital Consent

- Latvia's age of digital consent: **13 years old**.
- Users **under 13** must have verifiable parental consent before creating an account.
- Implementation: During registration, collect date of birth. If under 13, require parent email and consent confirmation before activating the account.

### Parental Consent Flow

1. User enters date of birth during sign-up.
2. If under 13 → show "Vecāku piekrišana nepieciešama" (Parental consent required).
3. Collect parent email → send consent request email with unique link.
4. Parent clicks link → confirms consent.
5. Only then is the account activated.
6. Store `parentEmail` and `parentConsentGiven: true` in user doc.

### Data Minimization

- Collect only what's needed: email, display name, grade (optional), date of birth.
- Chat messages stored for user convenience — user can delete anytime.
- No analytics tracking beyond aggregate usage counts.

### Right to Erasure (Article 17)

- Users can delete their account via settings.
- Deletion must remove: user doc, all usage records, all conversations + messages, Stripe customer (via API), any invite records.
- Implementation: `DELETE /api/auth/account` → cascading delete.

### Data Processing

- Firebase (Google) is the data processor for auth + Firestore → Google's DPA covers this.
- DeepSeek API: Check their data processing terms. **Do not send PII** to DeepSeek — only the anonymized question + curriculum context.
- Anthropic API: Has a DPA available. Claude does not train on API data.
- Stripe: Has its own GDPR compliance and DPA.

### Privacy Policy Requirements

Create `src/app/(marketing)/privacy/page.tsx` with:
- What data we collect and why
- How we process it (AI providers, Stripe)
- Data retention periods
- How to delete your data
- Contact: Stepe Digital, Gulbene, Latvia
- Language: Must be available in Latvian

### For School Pro (B2B)

Schools are data controllers for their students. We are the data processor. Need:
- **Data Processing Agreement (DPA)** template for schools.
- Schools must have their own legal basis for sharing student data with us.
- Teacher dashboard must not expose individual student conversations — only aggregate stats.

## Company Registration

### Current Status

Operating as a sole trader / individual. Before first B2B (School Pro) deal:

- Register **SIA** (Sabiedrība ar ierobežotu atbildību) — ~€280.
- Required for: B2B invoicing, formal contracts with schools, LIAA grant eligibility.
- Company name: **Stepe Digital SIA** (verify availability at ur.gov.lv).

### LIAA AI Grant

- Up to €200,000 available through LIAA (Investment and Development Agency of Latvia).
- Apply early — process takes months.
- Eligibility requires registered SIA.
- Align application with ESF+ digital education goals.

## Stripe Compliance

- Must display clear pricing before checkout.
- Subscription terms must be visible (monthly billing, cancellation policy).
- Latvian consumer protection: 14-day cooling-off period for online purchases.
- Store Stripe customer ID and subscription ID for audit trail.

## Checklist Before Launch

- [ ] Privacy policy page (Latvian + English)
- [ ] Terms of service page
- [ ] Cookie consent banner (if any analytics added)
- [ ] Parental consent flow working
- [ ] Account deletion working end-to-end
- [ ] No VISC content in ChromaDB
- [ ] DeepSeek API calls contain no PII
- [ ] Stripe checkout shows pricing clearly
