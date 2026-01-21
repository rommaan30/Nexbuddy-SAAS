import Stripe from "stripe";

const globalForStripe = globalThis as unknown as {
  stripe: Stripe | undefined;
};

function requireStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY env var");
  return key;
}

/**
 * Lazy Stripe singleton.
 * Important: do NOT read env vars at module import time, because Next build can
 * import route modules without runtime env configured.
 */
export function getStripe(): Stripe {
  if (globalForStripe.stripe) return globalForStripe.stripe;

  console.log("Creating Stripe client");
  const client = new Stripe(requireStripeSecretKey(), { typescript: true });
  if (process.env.NODE_ENV !== "production") globalForStripe.stripe = client;
  return client;
}
