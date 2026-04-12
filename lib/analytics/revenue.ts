import { getAnalytics, isSupported, logEvent } from "firebase/analytics";
import { app } from "@/lib/firebase/client";

export type PaidPlanId = "pro" | "premium";
export type RevenueBillingInterval = "monthly" | "annual";

const PLAN_VALUE_EUR: Record<
  PaidPlanId,
  Record<RevenueBillingInterval, number>
> = {
  pro: { monthly: 5.99, annual: 59.99 },
  premium: { monthly: 14.99, annual: 143.99 },
};

export function checkoutValueEur(
  plan: PaidPlanId,
  interval: RevenueBillingInterval = "monthly",
): number {
  return PLAN_VALUE_EUR[plan][interval];
}

/** Fire-and-forget: logs before Stripe redirect; do not block navigation on errors. */
export async function logCheckoutStarted(params: {
  plan: PaidPlanId;
  source: string;
  interval?: RevenueBillingInterval;
}): Promise<void> {
  if (typeof window === "undefined") return;
  const supported = await isSupported().catch(() => false);
  if (!supported) return;
  const interval = params.interval ?? "monthly";
  const value = checkoutValueEur(params.plan, interval);
  try {
    logEvent(getAnalytics(app), "checkout_started", {
      plan: params.plan,
      billing_interval: interval,
      source: params.source,
      currency: "EUR",
      value,
    });
  } catch {
    // Missing measurement ID or init failure — do not break checkout
  }
}

export async function logPurchase(params: {
  sessionId: string;
  plan: PaidPlanId;
  interval?: RevenueBillingInterval;
}): Promise<void> {
  if (typeof window === "undefined") return;
  const supported = await isSupported().catch(() => false);
  if (!supported) return;
  const interval = params.interval ?? "monthly";
  const value = checkoutValueEur(params.plan, interval);
  try {
    logEvent(getAnalytics(app), "purchase", {
      transaction_id: params.sessionId,
      currency: "EUR",
      value,
      items: [
        {
          item_id: `${params.plan}_${interval}`,
          item_name:
            params.plan === "pro"
              ? interval === "annual"
                ? "Pro (annual)"
                : "Pro"
              : interval === "annual"
                ? "Premium (annual)"
                : "Premium",
          price: value,
        },
      ],
    });
  } catch {
    // ignore
  }
}
