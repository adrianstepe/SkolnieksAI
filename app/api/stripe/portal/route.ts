import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userRef = adminDb.collection("users").doc(decoded.uid);
  const userDoc = await userRef.get();
  const userData = userDoc.exists
    ? (userDoc.data() as Record<string, unknown>)
    : {};
  const stripeCustomerId = userData.stripeCustomerId as string | undefined;

  if (!stripeCustomerId) {
    return NextResponse.json({ error: "no_stripe_customer" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: appUrl,
  });

  return NextResponse.json({ url: session.url });
}
