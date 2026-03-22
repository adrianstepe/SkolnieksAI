import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set");
}

export const stripe = new Stripe(stripeSecretKey, {
  typescript: true,
});

export const PRICE_IDS = {
  premium: process.env.STRIPE_PRICE_PREMIUM ?? "",
  exam_prep: process.env.STRIPE_PRICE_EXAM_PREP ?? "",
} as const;

export type PlanId = keyof typeof PRICE_IDS;
