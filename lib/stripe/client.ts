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

/** Maps plan + billing cadence to server-side Stripe Price ID env var names. */
const PRICE_ENV_KEYS: Record<PlanId, Record<BillingInterval, string>> = {
  pro: {
    monthly: "STRIPE_PRICE_PRO",
    annual: "STRIPE_PRO_ANNUAL_PRICE_ID",
  },
  premium: {
    monthly: "STRIPE_PRICE_PREMIUM",
    annual: "STRIPE_PREMIUM_ANNUAL_PRICE_ID",
  },
};

/** Resolves the Stripe Price ID for Checkout. Returns "" if the env var is unset. */
export function getPriceId(plan: PlanId, interval: BillingInterval = "monthly"): string {
  const key = PRICE_ENV_KEYS[plan][interval];
  return process.env[key] ?? "";
}

// Backward-compatible accessors; monthly remains the default for legacy imports.
export const PRICE_IDS = {
  get pro() {
    return getPriceId("pro", "monthly");
  },
  get premium() {
    return getPriceId("premium", "monthly");
  },
  annual: {
    get pro() {
      return getPriceId("pro", "annual");
    },
    get premium() {
      return getPriceId("premium", "annual");
    },
  },
} as const;
