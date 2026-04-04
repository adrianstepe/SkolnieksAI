import { getAnalytics, isSupported, logEvent } from "firebase/analytics";
import { app } from "@/lib/firebase/client";

export type PaidPlanId = "pro" | "premium";

const PLAN_VALUE_EUR: Record<PaidPlanId, number> = {
  pro: 5.99,
  premium: 14.99,
};

/** Fire-and-forget: logs before Stripe redirect; do not block navigation on errors. */
export async function logCheckoutStarted(params: {
  plan: PaidPlanId;
  source: string;
}): Promise<void> {
  if (typeof window === "undefined") return;
  const supported = await isSupported().catch(() => false);
  if (!supported) return;
  try {
    logEvent(getAnalytics(app), "checkout_started", {
      plan: params.plan,
      source: params.source,
      currency: "EUR",
      value: PLAN_VALUE_EUR[params.plan],
    });
  } catch {
    // Missing measurement ID or init failure — do not break checkout
  }
}

export async function logPurchase(params: {
  sessionId: string;
  plan: PaidPlanId;
}): Promise<void> {
  if (typeof window === "undefined") return;
  const supported = await isSupported().catch(() => false);
  if (!supported) return;
  try {
    logEvent(getAnalytics(app), "purchase", {
      transaction_id: params.sessionId,
      currency: "EUR",
      value: PLAN_VALUE_EUR[params.plan],
      items: [
        {
          item_id: params.plan,
          item_name: params.plan === "pro" ? "Pro" : "Premium",
          price: PLAN_VALUE_EUR[params.plan],
        },
      ],
    });
  } catch {
    // ignore
  }
}
