import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

/** Masks an email address for display: "adrians@gmail.com" → "a******@gmail.com" */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const masked = local[0] + "*".repeat(Math.max(local.length - 1, 1));
  return `${masked}@${domain}`;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token || token.length !== 64) {
    return NextResponse.json({ valid: false, reason: "not_found" });
  }

  let doc;
  try {
    doc = await adminDb.collection("passwordResetTokens").doc(token).get();
  } catch (err) {
    console.error("[verify-reset-token] Firestore read failed:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  if (!doc.exists) {
    return NextResponse.json({ valid: false, reason: "not_found" });
  }

  const data = doc.data() as {
    email: string;
    expiresAt: number;
    used: boolean;
  };

  if (data.used) {
    return NextResponse.json({ valid: false, reason: "used" });
  }

  if (data.expiresAt <= Date.now()) {
    return NextResponse.json({ valid: false, reason: "expired" });
  }

  return NextResponse.json({ valid: true, maskedEmail: maskEmail(data.email) });
}
