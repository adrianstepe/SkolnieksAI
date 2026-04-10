import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { verifyAuthToken } from "@/lib/firebase/auth";
import { adminDb } from "@/lib/firebase/admin";
import { sendCancellationConfirmationEmail } from "@/lib/email/resend";

// EU Directive 2023/2673 — standardised 2-click cancellation.
// This endpoint cancels the subscription immediately (not at period end)
// to comply strictly with the directive's requirement for no-friction withdrawal.
export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userRef = adminDb.collection("users").doc(decoded.uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const userData = userDoc.data() as Record<string, unknown>;
  const subscriptionId = userData.stripeSubscriptionId as string | undefined;

  if (!subscriptionId) {
    return NextResponse.json(
      { error: "no_active_subscription" },
      { status: 400 },
    );
  }

  try {
    await stripe.subscriptions.cancel(subscriptionId);
  } catch (err) {
    console.error("[stripe/cancel] Stripe error:", err);
    return NextResponse.json(
      { error: "stripe_error" },
      { status: 500 },
    );
  }

  const cancelledAt = new Date().toISOString();

  await userRef.update({
    tier: "free",
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    cancelledAt,
  });

  const email = (userData.email as string | undefined) ?? decoded.email ?? null;
  const displayName =
    (userData.displayName as string | undefined) ?? null;

  if (email) {
    // Fire-and-forget — failure must not block the cancellation response.
    sendCancellationConfirmationEmail({ to: email, displayName, cancelledAt }).catch(
      (err: unknown) =>
        console.error("[stripe/cancel] Email send failed:", err),
    );
  }

  return NextResponse.json({ success: true, cancelledAt });
}
