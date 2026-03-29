import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { sendPasswordResetEmail } from "@/lib/email/reset-template";
import { z } from "zod";
import crypto from "crypto";

const Schema = z.object({
  email: z.string().email(),
});

// Generic response — never reveal whether an email exists (prevents enumeration)
const OK = NextResponse.json({ success: true });

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();

  // Verify the email exists in Firebase Auth (but don't reveal to client if it doesn't)
  try {
    await adminAuth.getUserByEmail(email);
  } catch {
    // User not found — return generic success to prevent user enumeration
    return OK;
  }

  // Rate limit: if a non-expired, non-used token was created in the last 60 seconds
  // for this email, return success without creating a new one to prevent spam.
  const now = Date.now();
  try {
    const snapshot = await adminDb
      .collection("passwordResetTokens")
      .where("email", "==", email)
      .get();

    const recentActive = snapshot.docs.some((doc) => {
      const d = doc.data() as { used: boolean; expiresAt: number; createdAt: number };
      return !d.used && d.expiresAt > now && d.createdAt > now - 60_000;
    });

    if (recentActive) return OK;
  } catch (err) {
    console.error("[forgot-password] Rate-limit check failed:", err);
    // Non-fatal — fall through and create token
  }

  // Generate a 64-char hex token (256-bit entropy)
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = now + 5 * 60 * 1000; // 5 minutes

  try {
    await adminDb.collection("passwordResetTokens").doc(token).set({
      email,
      expiresAt,
      used: false,
      createdAt: now,
    });
  } catch (err) {
    console.error("[forgot-password] Firestore write failed:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  // Build reset URL and send email (failure is non-fatal — return generic success)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://skolnieks.ai";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;
  await sendPasswordResetEmail(email, resetUrl);

  return OK;
}
