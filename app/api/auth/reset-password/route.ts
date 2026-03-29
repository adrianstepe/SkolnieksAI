import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { z } from "zod";

const Schema = z.object({
  token: z.string().length(64),
  password: z.string().min(8).max(128),
});

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

  const { token, password } = parsed.data;
  const tokenRef = adminDb.collection("passwordResetTokens").doc(token);

  // Use a Firestore transaction to atomically validate and consume the token,
  // preventing a race condition where two simultaneous requests both read
  // used=false before either writes used=true.
  let email: string;
  try {
    email = await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(tokenRef);

      if (!doc.exists) {
        throw Object.assign(new Error("not_found"), { code: "not_found" });
      }

      const data = doc.data() as {
        email: string;
        expiresAt: number;
        used: boolean;
      };

      if (data.used) {
        throw Object.assign(new Error("used"), { code: "used" });
      }

      if (data.expiresAt <= Date.now()) {
        throw Object.assign(new Error("expired"), { code: "expired" });
      }

      // Consume the token
      tx.update(tokenRef, { used: true });

      return data.email;
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "not_found" || code === "used" || code === "expired") {
      return NextResponse.json({ error: code }, { status: 400 });
    }
    console.error("[reset-password] Transaction failed:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  // Update the password via Admin SDK
  try {
    const userRecord = await adminAuth.getUserByEmail(email);
    await adminAuth.updateUser(userRecord.uid, { password });
  } catch (err) {
    console.error("[reset-password] Admin SDK updateUser failed:", err);
    // Token was already consumed — roll back by un-marking it, best effort
    try {
      await tokenRef.update({ used: false });
    } catch {
      // ignore rollback failure
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
