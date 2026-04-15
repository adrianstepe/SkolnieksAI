/**
 * POST /api/affiliate/validate
 *
 * Called when a user enters a code that wasn't a peer referral.
 * Checks if the code is an active affiliate code and stores it on the user profile.
 * Also called from the UpgradeModal to preview discount before checkout.
 *
 * GET /api/affiliate/validate?code=XYZ
 *   Public preview: returns { valid, discountPercent, creatorName } — no auth needed.
 *   Used by the UpgradeModal to show the discount before the user hits checkout.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const AttachSchema = z.object({
  code: z.string().min(1).max(20),
});

/** GET — unauthenticated preview so the UpgradeModal can show the discount live. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.toUpperCase().trim();
  if (!code) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const snap = await adminDb.collection("affiliateCodes").doc(code).get();
  if (!snap.exists) {
    return NextResponse.json({ valid: false });
  }

  const data = snap.data() as Record<string, unknown>;
  if (!data.active) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({
    valid: true,
    discountPercent: data.discountPercent as number,
    creatorName: data.creatorName as string,
  });
}

/** POST — authenticated: attach the affiliate code to the current user's profile. */
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

  const parsed = AttachSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  const code = parsed.data.code.toUpperCase().trim();

  const codeSnap = await adminDb.collection("affiliateCodes").doc(code).get();
  if (!codeSnap.exists) {
    return NextResponse.json({ error: "invalid_affiliate_code" }, { status: 404 });
  }

  const codeData = codeSnap.data() as Record<string, unknown>;
  if (!codeData.active) {
    return NextResponse.json({ error: "code_inactive" }, { status: 410 });
  }

  const userRef = adminDb.collection("users").doc(decoded.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const userData = userSnap.data() as Record<string, unknown>;
  // Don't overwrite an existing affiliate code
  if (userData.affiliateCode) {
    return NextResponse.json({ error: "already_has_affiliate_code" }, { status: 409 });
  }

  await userRef.update({ affiliateCode: code });

  return NextResponse.json({
    success: true,
    discountPercent: codeData.discountPercent as number,
  });
}
