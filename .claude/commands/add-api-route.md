# Add API Route

Scaffold a new Next.js API route with project conventions.

## Instructions

1. Ask: route path (e.g., `/api/users/profile`), HTTP methods, auth required?
2. Create route handler in `src/app/api/[path]/route.ts`
3. Include:
   - Zod schema for request validation
   - Firebase Auth token verification (if auth required)
   - Proper error responses with status codes
   - TypeScript return types
4. Create colocated `.test.ts` with test cases for:
   - Happy path
   - Invalid input (Zod rejection)
   - Unauthorized access (if auth required)
5. Run `npm run lint && npm run test`

## Template

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAuth } from '@/lib/firebase/admin';

const RequestSchema = z.object({ /* ... */ });

export async function POST(req: NextRequest) {
  const authResult = await verifyAuth(req);
  if (!authResult.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // ... logic
  return NextResponse.json({ /* ... */ });
}
```
