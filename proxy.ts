import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decodeJwt } from "jose";

// Routes that require admin session
const PROTECTED_PATHS = ["/admin-dashboard"];
const LOGIN_PATH = "/admin-login";

// ---------------------------------------------------------------------------
// Burst rate limiting for /api/chat is handled inside the route handler
// (lib/ratelimit.ts + REDIS_URL) because Vercel Edge middleware cannot open
// TCP connections. The route enforces 5 req/60 s per UID. Firestore daily
// caps are the backstop if Redis is unavailable.
// ---------------------------------------------------------------------------

/**
 * Extract the Firebase UID from the Authorization header.
 * At the edge we only decode (no Firebase Admin SDK), so we trust the
 * signature was valid when the client obtained the token. Full server-side
 * verification still happens inside the route handler.
 *
 * Returns null if the header is absent or the token is malformed.
 */
export function extractUidFromAuthHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  try {
    const payload = decodeJwt(token);
    return (payload.user_id as string) ?? (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

/**
 * Build the Content-Security-Policy header value for a given nonce.
 * style-src keeps 'unsafe-inline' for Tailwind; tighten with style nonces later.
 * 'unsafe-eval' is injected only in development for Turbopack HMR/error overlays.
 */
function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${isDev ? "'unsafe-eval' " : ""}https://js.stripe.com https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com https://www.google-analytics.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.googleapis.com https://www.google-analytics.com https://www.google.com",
    "font-src 'self'",
    [
      "connect-src 'self'",
      "https://api.deepseek.com",
      "https://api.anthropic.com",
      "https://firebase.googleapis.com",
      "https://firebaseinstallations.googleapis.com",
      "https://*.googleapis.com",
      "https://www.google-analytics.com",
      "https://region1.google-analytics.com",
      "https://region2.google-analytics.com",
      "https://js.stripe.com",
      "https://*.skolnieksai.lv",
      "https://skolnieksai.firebaseapp.com",
    ].join(" "),
    "frame-src 'self' https://js.stripe.com https://skolnieksai.firebaseapp.com",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

/** Attach all security headers to an outgoing response. */
function applySecurityHeaders(response: NextResponse, nonce: string): void {
  response.headers.set("Content-Security-Policy", buildCspHeader(nonce));
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
}

export async function proxy(request: NextRequest) {
  // Defense-in-depth against CVE-2025-29927
  if (request.headers.get("x-middleware-subrequest")) {
    return new NextResponse(null, { status: 400 });
  }

  const nonce = btoa(crypto.randomUUID());
  const { pathname } = request.nextUrl;

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
    "/((?!_next/static|_next/image|favicon\\.ico).*)",
  ],
};
