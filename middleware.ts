import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require admin session
const PROTECTED_PATHS = ["/admin-dashboard"];
const LOGIN_PATH = "/admin-login";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (!isProtected) return NextResponse.next();

  const session = request.cookies.get("admin_session");

  if (!session?.value) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Validate session value — must equal the expected token stored in the cookie
  const expected = process.env.ADMIN_SESSION_SECRET;
  if (!expected || session.value !== expected) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin-dashboard", "/admin-dashboard/:path*"],
};
