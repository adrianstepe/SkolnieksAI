import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const RedeemSchema = z.object({
  referralCode: z.string().min(1),
});

/** Sentinel errors thrown inside the transaction to signal business-logic failures. */
class ReferralError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ReferralError";
  }
}

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = RedeemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { referralCode } = parsed.data;

  // Resolve the referrer outside the transaction (read-only lookup, no contention risk)
  const referrerSnap = await adminDb
    .collection("users")
    .where("referralCode", "==", referralCode)
    .limit(1)
    .get();

  if (referrerSnap.empty) {
    return NextResponse.json({ error: "invalid_referral_code" }, { status: 404 });
  }

  const referrerId = referrerSnap.docs[0].id;

  if (referrerId === decoded.uid) {
    return NextResponse.json({ error: "self_referral_not_allowed" }, { status: 400 });
  }

  const currentUserRef = adminDb.collection("users").doc(decoded.uid);
  const referrerRef = adminDb.collection("users").doc(referrerId);

  try {
    await adminDb.runTransaction(async (tx) => {
      const [currentUserDoc, referrerDoc] = await Promise.all([
        tx.get(currentUserRef),
        tx.get(referrerRef),
      ]);

      if (!currentUserDoc.exists) {
        throw new ReferralError("user_not_found");
      }

      const currentUserData = currentUserDoc.data() as Record<string, unknown>;
      if (currentUserData.referredBy) {
        throw new ReferralError("already_referred");
      }

      const referrerData = referrerDoc.data() as Record<string, unknown>;
      const newInviteCount = ((referrerData.inviteCount as number) ?? 0) + 1;

      // Mark the current user as referred
      tx.update(currentUserRef, { referredBy: referrerId });

      // Increment the referrer's invite count and conditionally upgrade their tier
      const referrerUpdate: Record<string, unknown> = {
        inviteCount: FieldValue.increment(1),
      };

      if (newInviteCount === 3) {
        const premiumExpiresAt = new Date();
        premiumExpiresAt.setDate(premiumExpiresAt.getDate() + 7);
        referrerUpdate.tier = "premium";
        referrerUpdate.premiumExpiresAt = premiumExpiresAt.toISOString();
      }

      tx.update(referrerRef, referrerUpdate);
    });
  } catch (err) {
    if (err instanceof ReferralError) {
      const status = err.code === "user_not_found" ? 404 : 409;
      return NextResponse.json({ error: err.code }, { status });
    }
    throw err;
  }

  return NextResponse.json({ success: true });
}
