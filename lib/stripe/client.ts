import Stripe from "stripe";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }
  return new Stripe(key, { typescript: true });
}

// Lazy proxy — defers initialization to first request, not module load.
// Prevents Next.js build failures when env vars aren't set at build time.
export const stripe: Stripe = new Proxy({} as Stripe, {
  get: (_, prop) => Reflect.get(getStripe(), prop as string),
});

export type PlanId = "pro" | "premium";
export type BillingInterval = "monthly" | "annual";

export function getPriceId(plan: PlanId, interval: BillingInterval = "monthly"): string {
  const envKeys: Record<PlanId, Record<BillingInterval, string>> = {
    pro: { monthly: "STRIPE_PRICE_PRO", annual: "STRIPE_PRO_ANNUAL_PRICE_ID" },
    premium: { monthly: "STRIPE_PRICE_PREMIUM", annual: "STRIPE_PREMIUM_ANNUAL_PRICE_ID" },
  };
  return process.env[envKeys[plan][interval]] ?? "";
}

// Kept for backward-compatibility with any callers that import PRICE_IDS.
// Returns monthly prices by default.
export const PRICE_IDS = {
  get pro() { return getPriceId("pro", "monthly"); },
  get premium() { return getPriceId("premium", "monthly"); },
} as const;
