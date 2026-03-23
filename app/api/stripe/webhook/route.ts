import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "webhook_not_configured" },
      { status: 500 },
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error(
      "Webhook signature verification failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const firebaseUid = session.metadata?.firebaseUid;
      const plan = session.metadata?.plan;

      if (!firebaseUid || !plan) {
        console.error("Missing metadata in checkout session:", session.id);
        break;
      }

      // Retrieve subscription to get currentPeriodEnd
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (!subscriptionId) {
        console.error("No subscription ID in session:", session.id);
        break;
      }

      const subResponse =
        await stripe.subscriptions.retrieve(subscriptionId);
      const subscriptionData =
        "data" in subResponse ? subResponse.data : subResponse;

      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id ?? "";

      const tierMap: Record<string, string> = {
        premium: "premium",
        exam_prep: "exam_prep",
      };

      const periodEnd = (subscriptionData as Record<string, unknown>)
        .current_period_end as number;

      const resolvedTier = tierMap[plan];
      if (!resolvedTier) {
        console.error(`Unrecognized plan "${plan}" in session ${session.id} — aborting tier update`);
        break;
      }

      await adminDb
        .collection("users")
        .doc(firebaseUid)
        .update({
          tier: resolvedTier,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          currentPeriodEnd: new Date(periodEnd * 1000).toISOString(),
        });

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id;

      if (!customerId) break;

      // Find user by stripeCustomerId
      const usersSnapshot = await adminDb
        .collection("users")
        .where("stripeCustomerId", "==", customerId)
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        await usersSnapshot.docs[0].ref.update({
          tier: "free",
          stripeSubscriptionId: null,
          currentPeriodEnd: null,
        });
      }

      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;

      if (!customerId) break;

      const usersSnapshot = await adminDb
        .collection("users")
        .where("stripeCustomerId", "==", customerId)
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        await usersSnapshot.docs[0].ref.update({
          paymentFailed: true,
          paymentFailedAt: new Date().toISOString(),
        });
      }

      break;
    }
  }

  return NextResponse.json({ received: true });
}
