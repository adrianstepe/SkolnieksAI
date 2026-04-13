import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { stripe } from "@/lib/stripe/client";
import { adminDb } from "@/lib/firebase/admin";

/** Zeros the current calendar month usage doc (same shape as `invoice.paid`). */
async function resetCurrentMonthUsage(userRef: DocumentReference): Promise<void> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await userRef.collection("usage").doc(yearMonth).set(
    { inputTokens: 0, outputTokens: 0, queryCount: 0, dailyCount: 0 },
    { merge: true },
  );
}

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
      const interval = session.metadata?.interval ?? "monthly";

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
        pro: "pro",
        premium: "premium",
      };

      const periodEnd = (subscriptionData as Record<string, unknown>)
        .current_period_end as number;

      const resolvedTier = tierMap[plan];
      if (!resolvedTier) {
        console.error(`Unrecognized plan "${plan}" in session ${session.id} — aborting tier update`);
        break;
      }

      const userRef = adminDb.collection("users").doc(firebaseUid);
      await userRef.update({
        tier: resolvedTier,
        billingInterval: interval,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        currentPeriodEnd: new Date(periodEnd * 1000).toISOString(),
      });

      // Annual: first charge does not reliably pair with a separate monthly
      // `invoice.paid` cadence the way monthly subscriptions do — reset the
      // current month’s token budget here so paid limits apply immediately.
      if (interval === "annual") {
        await resetCurrentMonthUsage(userRef);
        await userRef.update({ paymentFailed: false });
      }

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
          billingInterval: FieldValue.delete(),
        });
      }

      break;
    }

    case "invoice.paid": {
      // Reset monthly usage budget when an invoice is paid.
      // Monthly subscribers trigger this every month; annual subscribers
      // trigger it once per year (initial budget reset for annual plans
      // happens in checkout.session.completed above).
      const paidInvoice = event.data.object as Stripe.Invoice;
      const paidCustomerId =
        typeof paidInvoice.customer === "string"
          ? paidInvoice.customer
          : paidInvoice.customer?.id;

      if (!paidCustomerId) break;

      const paidUsersSnapshot = await adminDb
        .collection("users")
        .where("stripeCustomerId", "==", paidCustomerId)
        .limit(1)
        .get();

      if (!paidUsersSnapshot.empty) {
        const userDoc = paidUsersSnapshot.docs[0];
        await resetCurrentMonthUsage(userDoc.ref);
        await userDoc.ref.update({ paymentFailed: false });
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
