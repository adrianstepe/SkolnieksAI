/**
 * Admin-only: create and list affiliate/influencer codes.
 *
 * POST /api/admin/affiliate
 *   Body: { code, creatorName, discountPercent, commissionPercent }
 *   Creates a Stripe coupon + Firestore record.
 *
 * GET /api/admin/affiliate
 *   Returns all affiliate codes with stats.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { stripe } from "@/lib/stripe/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdminAuthorized(request: NextRequest): boolean {
  const session = request.cookies.get("admin_session");
  const expected = process.env.ADMIN_SESSION_SECRET;
  if (!expected || !session?.value) return false;
  return session.value === expected;
}

const CreateSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, "Only uppercase letters, digits, _ and - allowed"),
  creatorName: z.string().min(1).max(80),
  discountPercent: z.number().int().min(1).max(80),
  commissionPercent: z.number().int().min(1).max(80),
});

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { code, creatorName, discountPercent, commissionPercent } = parsed.data;

  // Check for duplicate code
  const existing = await adminDb.collection("affiliateCodes").doc(code).get();
  if (existing.exists) {
    return NextResponse.json({ error: "code_already_exists" }, { status: 409 });
  }

  // Create a Stripe coupon so the discount is applied natively at checkout
  let stripeCouponId: string | null = null;
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const coupon = await stripe.coupons.create({
        id: `AFFILIATE_${code}`,
        percent_off: discountPercent,
        duration: "once",
        name: `${creatorName} — ${discountPercent}% off`,
        metadata: { affiliateCode: code, creatorName },
      });
      stripeCouponId = coupon.id;
    } catch (err) {
      console.error("[admin/affiliate] Stripe coupon creation failed:", err);
      // Non-fatal: store without Stripe coupon; discount won't apply at checkout
    }
  }

  const now = new Date().toISOString();
  await adminDb.collection("affiliateCodes").doc(code).set({
    code,
    creatorName,
    discountPercent,
    commissionPercent,
    stripeCouponId,
    active: true,
    createdAt: now,
    totalUses: 0,
    totalRevenueCents: 0,
    totalCommissionCents: 0,
  });

  return NextResponse.json({ success: true, code, stripeCouponId }, { status: 201 });
}

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const snap = await adminDb
    .collection("affiliateCodes")
    .orderBy("createdAt", "desc")
    .get();

  const codes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ codes });
}
