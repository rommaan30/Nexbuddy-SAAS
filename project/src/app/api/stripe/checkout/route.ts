export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { readAuthTokenFromCookieHeader } from "@/lib/auth/cookies";
import { verifyToken } from "@/lib/auth/jwt";

type PlanCode = "BASIC" | "ADVANCED" | "PRO";

type CheckoutRequestBody = {
  planCode: PlanCode;
};

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

const ALLOWED_PLAN_CODES = [
  "BASIC",
  "ADVANCED",
  "PRO",
] as const satisfies readonly PlanCode[];

function parseCheckoutBody(body: unknown): CheckoutRequestBody | null {
  if (!body || typeof body !== "object") return null;
  const planCode = (body as Record<string, unknown>).planCode;
  if (typeof planCode !== "string") return null;
  if (!ALLOWED_PLAN_CODES.includes(planCode as PlanCode)) return null;
  return { planCode: planCode as PlanCode };
}

export async function POST(req: Request) {
  try {
    // Auth: JWT must exist and verify.
    const token = readAuthTokenFromCookieHeader(req.headers.get("cookie"));
    if (!token) return jsonError(401, "Authentication required");

    // Ensure JWT secret exists before verification (otherwise verifyToken will throw).
    if (!process.env.JWT_SECRET) {
      return NextResponse.json(
        { error: "Stripe checkout failed" },
        { status: 500 }
      );
    }

    let userId: string;
    try {
      const payload = verifyToken(token);
      userId = payload.userId;
      if (!userId) return jsonError(401, "Authentication required");
    } catch {
      return jsonError(401, "Authentication required");
    }

    // Env prereqs (do not leak details).
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe checkout failed" },
        { status: 500 }
      );
    }
    if (!process.env.NEXT_PUBLIC_APP_URL) {
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
      return jsonError(400, "Invalid JSON body");
    }

    const parsed = parseCheckoutBody(body);
    if (!parsed) return jsonError(400, "Invalid plan selected");
    const planCode = parsed.planCode;

    // DB prereqs
    const plan = await prisma.plan.findUnique({
      where: { code: planCode },
      select: { id: true, code: true, stripePriceId: true, priceMonthly: true },
    });

    if (!plan) return jsonError(400, "Invalid plan selected");

    const stripePriceId = plan.stripePriceId?.trim() ?? "";
    if (!stripePriceId) {
      return NextResponse.json(
        { error: "Stripe checkout failed" },
        { status: 500 }
      );
    }
    // Stripe recurring price IDs look like "price_..."
    if (!stripePriceId.startsWith("price_")) {
      return NextResponse.json(
        { error: "Stripe checkout failed" },
        { status: 500 }
      );
    }

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cancel`,
      metadata: { userId, planCode },
    });

    if (!session.url)
      return NextResponse.json(
        { error: "Stripe checkout failed" },
        { status: 500 }
      );
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("CHECKOUT API CRASH:", error);
    // 500 reserved for Stripe/session creation failures.
    return NextResponse.json(
      { error: "Stripe checkout failed" },
      { status: 500 }
    );
  }
}
