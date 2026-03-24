import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const validUser = process.env.ADMIN_USERNAME;
  const validPass = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (!validUser || !validPass || !sessionSecret) {
    return NextResponse.json(
      { error: "Admin credentials not configured." },
      { status: 500 }
    );
  }

  if (username !== validUser || password !== validPass) {
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });

  // 8-hour httpOnly session cookie
  response.cookies.set("admin_session", sessionSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });

  return response;
}
