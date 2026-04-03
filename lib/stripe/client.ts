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

export const PRICE_IDS = {
  pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? "",
  premium: process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM ?? "",
} as const;

export type PlanId = keyof typeof PRICE_IDS;
