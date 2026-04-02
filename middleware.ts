import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { decodeJwt } from "jose";

// Routes that require admin session
const PROTECTED_PATHS = ["/admin-dashboard"];
const LOGIN_PATH = "/admin-login";

// ---------------------------------------------------------------------------
// Upstash sliding-window rate limiter for /api/chat
// 5 requests per 60-second sliding window — applies to all tiers.
// Tier-specific limits (daily cap, monthly budget) are enforced in the route
// handler via Firestore; this layer is purely for DDoS / burst protection.
//
// Fail-open: if Redis is unavailable (no env vars or connection error), the
// request is allowed through. Firestore daily caps remain as the backstop.
// ---------------------------------------------------------------------------

let ratelimit: Ratelimit | null = null;

if (
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    prefix: "rl:chat",
    // Do not throw on Redis errors — degrade gracefully instead
    analytics: false,
  });
}

/**
 * Extract the Firebase UID from the Authorization header.
 * At the edge we only decode (no Firebase Admin SDK), so we trust the
 * signature was valid when the client obtained the token. Full server-side
 * verification still happens inside the route handler.
 *
 * Returns null if the header is absent or the token is malformed.
 */
function extractUidFromAuthHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  try {
    // decodeJwt does NOT verify the signature — fast, no async, no keys needed.
    // We only need the uid as a rate-limit key, not for authorization.
    const payload = decodeJwt(token);
    return (payload.user_id as string) ?? (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

/**
 * Build the Content-Security-Policy header value for a given nonce.
 * style-src keeps 'unsafe-inline' for Tailwind; tighten with style nonces later.
 */
function buildCspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://js.stripe.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.googleapis.com",
    "font-src 'self'",
    [
      "connect-src 'self'",
      "https://api.deepseek.com",
      "https://api.anthropic.com",
      "https://identitytoolkit.googleapis.com",
      "https://securetoken.googleapis.com",
      "https://firestore.googleapis.com",
      "https://js.stripe.com",
      "https://*.skolnieksai.lv",
    ].join(" "),
    "frame-src https://js.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

/** Attach all security headers to an outgoing response. */
function applySecurityHeaders(response: NextResponse, nonce: string): void {
  response.headers.set("Content-Security-Policy", buildCspHeader(nonce));
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
}

export async function middleware(request: NextRequest) {
  // Defense-in-depth against CVE-2025-29927: x-middleware-subrequest is an
  // internal Next.js routing header. External clients have no legitimate reason
  // to send it. Reject any request that arrives with it to prevent middleware
  // bypass attempts even if a future regression reintroduces the vulnerability.
  // (Next.js 16.2.0 is already patched; this is an extra safety net.)
  if (request.headers.get("x-middleware-subrequest")) {
    return new NextResponse(null, { status: 400 });
  }

  // Generate a per-request nonce. btoa(uuid) produces a valid base64 string
  // that is unguessable and unique per response.
  const nonce = btoa(crypto.randomUUID());

  const { pathname } = request.nextUrl;

  // --- Edge rate limiting for /api/chat ---
  if (pathname === "/api/chat" && request.method === "POST") {
    if (ratelimit !== null) {
      // Key by Firebase UID when available; fall back to IP.
      const uid = extractUidFromAuthHeader(request);
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown";
      const key = uid ?? ip;

      let limited = false;
      let resetMs = 0;

      try {
        const result = await ratelimit.limit(key);
        limited = !result.success;
        resetMs = result.reset;
      } catch {
        // Redis error — fail-open, let the request proceed
      }

      if (limited) {
        const retryAfterSecs = Math.ceil((resetMs - Date.now()) / 1000);
        return NextResponse.json(
          { error: "rate_limit_exceeded", retryAfter: retryAfterSecs },
          {
            status: 429,
            headers: { "Retry-After": String(Math.max(retryAfterSecs, 1)) },
          }
        );
      }
    }
  }

  // --- Admin dashboard protection ---
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isProtected) {
    const session = request.cookies.get("admin_session");

    if (!session?.value) {
      const loginUrl = new URL(LOGIN_PATH, request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const expected = process.env.ADMIN_SESSION_SECRET;
    if (!expected || session.value !== expected) {
      const loginUrl = new URL(LOGIN_PATH, request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Forward the nonce to Server Components so they can inject it into
  // <script nonce={nonce}> tags. Readable via headers() in any Server Component.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  applySecurityHeaders(response, nonce);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except Next.js internals and static assets.
     * CSP + security headers must run on every HTML page response so that
     * nonces are present before any script executes.
     */
    "/((?!_next/static|_next/image|favicon\\.ico).*)",
  ],
};
