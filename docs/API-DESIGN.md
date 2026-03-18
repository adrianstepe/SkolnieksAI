# API Design — SkolnieksAI

All routes are Next.js App Router API routes under `src/app/api/`.
Auth: Firebase ID token in `Authorization: Bearer <token>` header.
Validation: Zod schemas on all inputs.

## Chat

### `POST /api/chat`

Main endpoint. Streams AI response.

```typescript
// Request
{
  message: string;              // Max 2000 chars
  conversationId?: string;      // Omit to start new conversation
}

// Response: Server-Sent Events stream
data: {"type":"chunk","content":"Šis ir..."}
data: {"type":"chunk","content":" atbilde."}
data: {"type":"sources","chunks":["biology_7_p12_c3"]}
data: {"type":"done","tokensUsed":342,"conversationId":"abc123"}

// Error responses
429: {"error":"token_budget_exceeded","upgrade_url":"/pricing"}
401: {"error":"unauthorized"}
400: {"error":"validation_error","details":[...]}
```

Runtime: Edge (for streaming support on Vercel).

## Auth

### `POST /api/auth/register`

Creates Firestore user doc after Firebase Auth sign-up (client-side).

```typescript
// Request
{
  dateOfBirth?: string;         // ISO date
  grade?: number;               // 6-12
  inviteCode?: string;          // Referral code
}

// Response
200: {"success":true,"tier":"free"}
```

### `GET /api/auth/me`

Returns current user profile and usage.

```typescript
// Response
200: {
  user: UserDoc,
  usage: {
    tokensUsed: number,
    tokenBudget: number,
    queriesCount: number,
    budgetPercentUsed: number    // 0-100, for UI meter
  }
}
```

## Stripe

### `POST /api/stripe/checkout`

Creates Stripe Checkout session.

```typescript
// Request
{ tier: 'premium' | 'exam_prep' }

// Response
200: {"checkoutUrl":"https://checkout.stripe.com/..."}
```

### `POST /api/stripe/portal`

Creates Stripe Customer Portal session (manage subscription).

```typescript
// Response
200: {"portalUrl":"https://billing.stripe.com/..."}
```

### `POST /api/webhooks/stripe`

Stripe webhook handler. No auth header — validated by Stripe signature.

Events handled:
- `checkout.session.completed` → Upgrade tier, set token budget
- `invoice.paid` → Reset monthly token budget
- `customer.subscription.deleted` → Downgrade to Free
- `customer.subscription.updated` → Handle plan changes

## Conversations

### `GET /api/conversations`

List user's conversations, paginated.

```typescript
// Query params
?limit=20&cursor=<lastConversationId>

// Response
200: {
  conversations: ConversationDoc[],
  nextCursor: string | null
}
```

### `GET /api/conversations/[id]/messages`

Get messages in a conversation.

```typescript
// Response
200: { messages: MessageDoc[] }
```

### `DELETE /api/conversations/[id]`

Delete a conversation and all messages (GDPR compliance).

## Admin (Teacher Dashboard)

### `GET /api/admin/school/students`

List students in teacher's school. Requires `school_pro` tier.

```typescript
// Response
200: {
  students: {
    uid: string,
    displayName: string,
    queriesCount: number,
    lastActiveAt: Timestamp
  }[]
}
```

### `GET /api/admin/school/usage`

Aggregate school usage stats.

```typescript
// Response
200: {
  totalQueries: number,
  activeStudents: number,
  topSubjects: { subject: string, count: number }[]
}
```

## Invites

### `POST /api/invites/create`

Generate a referral invite code.

```typescript
// Response
200: {"code":"AB12CD34","shareUrl":"https://skolnieks.ai/invite/AB12CD34"}
```

### `POST /api/invites/redeem`

Redeem an invite code during registration.

```typescript
// Request
{ code: string }

// Response
200: {"success":true,"reward":"2_days_exam_prep"}
```

## Rate Limiting

- `/api/chat`: 10 requests/minute per user
- `/api/stripe/*`: 5 requests/minute per user
- `/api/invites/*`: 3 requests/minute per user
- `/api/admin/*`: 20 requests/minute per user

Enforced via middleware checking Firestore timestamps or Vercel KV.
