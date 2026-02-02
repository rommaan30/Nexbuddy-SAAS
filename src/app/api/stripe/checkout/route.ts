export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { readAuthTokenFromCookieHeader } from "@/lib/auth/cookies";
import { verifyToken } from "@/lib/auth/jwt";

type PlanCode = "FREE" | "BASIC" | "ADVANCED" | "PRO";

console.log(
  "Stripe key loaded:",
  process.env.STRIPE_SECRET_KEY?.startsWith("sk_")
);

type CheckoutRequestBody = {
  planCode: PlanCode;
};

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

// Only paid plans can use Stripe checkout
const ALLOWED_PLAN_CODES = [
  "BASIC",
  "ADVANCED",
  "PRO",
] as const satisfies readonly PlanCode[];

function parseCheckoutBody(body: unknown): CheckoutRequestBody | null {
  if (!body || typeof body !== "object") return null;
  const planCode = (body as Record<string, unknown>).planCode;
  if (typeof planCode !== "string") return null;
  // Only allow paid plans for Stripe checkout
  if (!ALLOWED_PLAN_CODES.includes(planCode as "BASIC" | "ADVANCED" | "PRO")) return null;
  return { planCode: planCode as "BASIC" | "ADVANCED" | "PRO" };
}

export async function POST(req: Request) {
  try {
    // Auth: JWT must exist and verify.
    const token = readAuthTokenFromCookieHeader(req.headers.get("cookie"));
    if (!token) {
      console.error("[CHECKOUT] No auth token in request");
      return jsonError(401, "Authentication required");
    }

    // Ensure JWT secret exists before verification (otherwise verifyToken will throw).
    if (!process.env.JWT_SECRET) {
      console.error("[CHECKOUT] JWT_SECRET missing");
      return NextResponse.json(
        { error: "Stripe checkout failed" },
        { status: 500 }
      );
    }

    let userId: string;
    try {
      const payload = verifyToken(token);
      userId = payload.userId;
      if (!userId) {
        console.error("[CHECKOUT] No userId in token payload");
        return jsonError(401, "Authentication required");
      }
    } catch (error) {
      console.error("[CHECKOUT] Token verification failed:", error instanceof Error ? error.message : "Unknown error");
      return jsonError(401, "Authentication required");
    }

    // Email verification guard: Block checkout for unverified users
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        emailVerified: true,
      } as { id: true; emailVerified: true },
    });

    if (!user) {
      console.error("[CHECKOUT] User not found", { userId });
      return jsonError(401, "User not found");
    }
    if (!(user as { emailVerified: boolean }).emailVerified) {
      console.error("[CHECKOUT] Email not verified", { userId });
      return jsonError(403, "Please verify your email before purchasing a plan");
    }

    // Env prereqs (do not leak details).
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("[CHECKOUT] STRIPE_SECRET_KEY missing");
      return NextResponse.json(
        { error: "Stripe checkout failed" },
        { status: 500 }
      );
    }
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      console.error("[CHECKOUT] NEXT_PUBLIC_APP_URL missing");
      return NextResponse.json(
        { error: "Stripe checkout failed" },
        { status: 500 }
      );
    }

    // Input: planCode must be valid.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      console.error("[CHECKOUT] Invalid JSON body");
      return jsonError(400, "Invalid JSON body");
    }

    const parsed = parseCheckoutBody(body);
    if (!parsed) {
      console.error("[CHECKOUT] Invalid plan code in body", { body });
      return jsonError(400, "Invalid plan selected");
    }
    const planCode = parsed.planCode;

    // Guard: FREE plan should not use Stripe checkout
    if (planCode === "FREE") {
      console.error("[CHECKOUT] FREE plan attempted via Stripe checkout");
      return jsonError(400, "Free plan does not require payment");
    }

    // DB prereqs
    const plan = await prisma.plan.findUnique({
      where: { code: planCode },
      select: { id: true, code: true, stripePriceId: true, priceMonthly: true },
    });

    if (!plan) {
      console.error("[CHECKOUT] Plan not found in database", { planCode });
      return jsonError(400, "Invalid plan selected");
    }

    // Paid plans must have Stripe price ID
    const stripePriceId = plan.stripePriceId?.trim() ?? "";
    if (!stripePriceId) {
      console.error("[CHECKOUT] Plan missing Stripe price ID", { planCode, planId: plan.id });
      return NextResponse.json(
        { error: "Stripe checkout failed" },
        { status: 500 }
      );
    }
    // Stripe recurring price IDs look like "price_..."
    if (!stripePriceId.startsWith("price_")) {
      console.error("[CHECKOUT] Invalid Stripe price ID format", { planCode, stripePriceId });
      return NextResponse.json(
        { error: "Stripe checkout failed" },
        { status: 500 }
      );
    }

    console.log("[CHECKOUT] Creating Stripe session", { planCode, userId, hasPriceId: !!stripePriceId });

    let session;
    try {
      session = await getStripe().checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: stripePriceId, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cancel`,
        metadata: { userId, planCode },
      });
    } catch (stripeError) {
      const errorMessage = stripeError instanceof Error ? stripeError.message : "Unknown Stripe error";
      console.error("[CHECKOUT] Stripe API error", {
        planCode,
        stripePriceId,
        error: errorMessage,
        userId,
      });
      // Re-throw to be caught by outer catch
      throw stripeError;
    }

    if (!session.url) {
      console.error("[CHECKOUT] Stripe session created but URL missing", { sessionId: session.id });
      return NextResponse.json(
        { error: "Stripe checkout failed" },
        { status: 500 }
      );
    }

    console.log("[CHECKOUT] Stripe session created successfully", { sessionId: session.id, planCode });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[CHECKOUT] API CRASH:", error);
    // 500 reserved for Stripe/session creation failures.
    return NextResponse.json(
      { error: "Stripe checkout failed" },
      { status: 500 }
    );
  }
}
