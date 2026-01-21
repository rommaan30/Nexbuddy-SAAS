import Stripe from "stripe";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Stripe CLI local testing:
 *   stripe listen --forward-to localhost:3000/api/stripe/webhook
 *
 * Note: Webhooks must use the raw request body (no JSON parsing) to verify signatures.
 */

function requireWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is missing");
  return secret;
}

function getStripeSignature(req: Request): string {
  const sig = req.headers.get("stripe-signature");
  if (!sig) throw new Error("Missing stripe-signature header");
  return sig;
}

type PlanCode = "BASIC" | "ADVANCED" | "PRO";
const ALLOWED_PLAN_CODES = [
  "BASIC",
  "ADVANCED",
  "PRO",
] as const satisfies readonly PlanCode[];

function isPlanCode(value: unknown): value is PlanCode {
  return (
    typeof value === "string" &&
    (ALLOWED_PLAN_CODES as readonly string[]).includes(value)
  );
}

function sessionIdFromCustomer(
  customer: Stripe.Checkout.Session["customer"]
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function sessionIdFromSubscription(
  subscription: Stripe.Checkout.Session["subscription"]
): string | null {
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const userId = session.metadata?.userId;
  const planCodeRaw = session.metadata?.planCode;

  if (!userId || typeof userId !== "string") {
    console.error("Webhook: missing metadata.userId", {
      sessionId: session.id,
    });
    return;
  }
  if (!isPlanCode(planCodeRaw)) {
    console.error("Webhook: missing/invalid metadata.planCode", {
      sessionId: session.id,
      planCodeRaw,
    });
    return;
  }
  const planCode = planCodeRaw;

  const stripeCustomerId = sessionIdFromCustomer(session.customer);
  const stripeSubscriptionId = sessionIdFromSubscription(session.subscription);

  if (!stripeCustomerId) {
    console.error("Webhook: missing customer on session", {
      sessionId: session.id,
    });
    return;
  }
  if (!stripeSubscriptionId) {
    console.error("Webhook: missing subscription on session", {
      sessionId: session.id,
    });
    return;
  }

  // Idempotency: If we already created a subscription for this Stripe subscription, do nothing.
  const existingByStripeSub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    select: { id: true },
  });
  if (existingByStripeSub) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error("Webhook: user not found", { userId, sessionId: session.id });
    return;
  }

  const plan = await prisma.plan.findUnique({
    // Prisma enum values are stored as strings; we validate PlanCode above.
    where: { code: planCode as unknown as never },
    select: { id: true, code: true },
  });
  if (!plan) {
    console.error("Webhook: plan not found", {
      planCode,
      sessionId: session.id,
    });
    return;
  }

  // Ensure tenant exists for this user (one tenant per user in this phase).
  const tenant =
    (await prisma.tenant.findUnique({
      where: { ownerId: user.id },
      select: { id: true },
    })) ??
    (await prisma.tenant.create({
      data: {
        ownerId: user.id,
        name: `Company of ${user.email}`,
      },
      select: { id: true },
    }));

  // Additional idempotency/uniqueness safety (schema has uniques on userId and tenantId).
  const existingByUser = await prisma.subscription.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existingByUser) return;

  await prisma.subscription.create({
    data: {
      userId: user.id,
      tenantId: tenant.id,
      planId: plan.id,
      status: "ACTIVE",
      stripeCustomerId,
      stripeSubscriptionId,
    },
    select: { id: true },
  });
}

export async function POST(req: Request) {
  // Reject invalid signatures (security requirement).
  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    const signature = getStripeSignature(req);
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      requireWebhookSecret()
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Only handle checkout.session.completed, ignore the rest.
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  try {
    const session = event.data.object as Stripe.Checkout.Session;
    await handleCheckoutSessionCompleted(session);
  } catch (error) {
    // Never crash webhook handler; log and return 200 for handled events.
    console.error("Stripe webhook handler error:", error);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
