import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readAuthTokenFromCookieHeader } from "@/lib/auth/cookies";
import { verifyToken } from "@/lib/auth/jwt";

/**
 * POST /api/plans/activate-free
 * 
 * Activates FREE plan for authenticated user.
 * Creates Tenant and Subscription if they don't exist.
 * No Stripe required.
 */
export async function POST(req: Request) {
  try {
    // Auth: JWT must exist and verify
    const token = readAuthTokenFromCookieHeader(req.headers.get("cookie"));
    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!process.env.JWT_SECRET) {
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 }
      );
    }

    let userId: string;
    try {
      const payload = verifyToken(token);
      userId = payload.userId;
      if (!userId) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Find FREE plan
    const freePlan = await prisma.plan.findUnique({
      where: { code: "FREE" },
      select: { id: true, code: true, name: true },
    });

    if (!freePlan) {
      return NextResponse.json(
        { error: "Free plan not available" },
        { status: 500 }
      );
    }

    // Check if user already has a subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { id: true, planId: true },
    });

    if (existingSubscription) {
      // User already has a subscription (could be FREE or paid)
      // Return success - they're already set up
      return NextResponse.json({ ok: true, message: "Already subscribed" });
    }

    // Get user email for tenant naming
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Create tenant and subscription in transaction
    await prisma.$transaction(async (tx) => {
      // Create or get tenant
      let tenant = await tx.tenant.findUnique({
        where: { ownerId: userId },
        select: { id: true },
      });

      if (!tenant) {
        tenant = await tx.tenant.create({
          data: {
            ownerId: userId,
            name: `Company of ${user.email}`,
          },
          select: { id: true },
        });
      }

      // Create FREE subscription (no Stripe required)
      await tx.subscription.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          planId: freePlan.id,
          status: "ACTIVE",
          // FREE plan doesn't use Stripe - use placeholder values
          stripeCustomerId: `free_${user.id}`,
          stripeSubscriptionId: `free_sub_${user.id}`,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      message: "Free plan activated successfully",
    });
  } catch (error) {
    console.error("Activate free plan error:", error);
    return NextResponse.json(
      { error: "Failed to activate free plan" },
      { status: 500 }
    );
  }
}
