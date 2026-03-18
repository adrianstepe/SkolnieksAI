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

### Under-13 Consent Flow
1. During signup, ask date of birth
2. If under 13: block account creation, show message:
   "Lai izmantotu SkolnieksAI, tev ir nepieciešama vecāku atļauja. Lūdzu, palūdz vecākiem reģistrēties tavā vārdā."
3. Parent creates account, links child profile
4. Store `parentConsent: true` + parent email in Firestore

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
