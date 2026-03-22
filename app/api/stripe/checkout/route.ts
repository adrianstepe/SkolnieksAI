import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { stripe, PRICE_IDS, type PlanId } from "@/lib/stripe/client";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";

const CheckoutSchema = z.object({
  plan: z.enum(["premium", "exam_prep"]),
});

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

  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }

  const plan: PlanId = parsed.data.plan;
  const priceId = PRICE_IDS[plan];

  if (!priceId) {
    return NextResponse.json(
      { error: "price_not_configured" },
      { status: 500 },
    );
  }

  // Check if user already has a Stripe customer ID
  const userRef = adminDb.collection("users").doc(decoded.uid);
  const userDoc = await userRef.get();
  const userData = userDoc.exists
    ? (userDoc.data() as Record<string, unknown>)
    : {};
  const existingCustomerId = userData.stripeCustomerId as string | undefined;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const sessionParams: Record<string, unknown> = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/payment/cancel`,
    metadata: {
      firebaseUid: decoded.uid,
      plan,
    },
  };

  if (existingCustomerId) {
    sessionParams.customer = existingCustomerId;
  } else {
    sessionParams.customer_email = decoded.email ?? undefined;
  }

  const session = await stripe.checkout.sessions.create(
    sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0],
  );

  return NextResponse.json({ url: session.url });
}
