import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildAuthCookie } from "@/lib/auth/cookies";
import { signToken } from "@/lib/auth/jwt";
import { parseAuthCredentials } from "@/lib/auth/validators";
import { badRequest, internalError } from "@/lib/http/errors";
import { generateVerificationTokenData } from "@/lib/email/verification";
import { sendVerificationEmail } from "@/lib/email/verification";

export async function POST(req: Request) {
  // Validate required environment variables early
  if (!process.env.JWT_SECRET) {
    const errorMsg = process.env.NODE_ENV === "development" 
      ? "Server configuration error: Missing JWT_SECRET environment variable"
      : "Server configuration error";
    return Response.json({ error: errorMsg }, { status: 500 });
  }

  if (!process.env.DATABASE_URL) {
    const errorMsg = process.env.NODE_ENV === "development" 
      ? "Server configuration error: Missing DATABASE_URL environment variable. Please create a .env.local file with your database connection string."
      : "Server configuration error: Database connection failed";
    return Response.json({ error: errorMsg }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const creds = parseAuthCredentials(body);
  if (!creds) return badRequest("Invalid name, email or password");

  try {
    // Check for existing user to prevent duplicate registration
    const existing = await prisma.user.findUnique({
      where: { email: creds.email },
      select: { id: true },
    });
    if (existing) return badRequest("User already exists");

    // Hash password with bcrypt (12 rounds for security)
    const passwordHash = await bcrypt.hash(creds.password, 12);

    // Find FREE plan for auto-assignment
    const freePlan = await prisma.plan.findUnique({
      where: { code: "FREE" },
      select: { id: true },
    });

    if (!freePlan) {
      console.error("FREE plan not found in database");
      return internalError();
    }

    // Generate email verification token (expires in 24 hours)
    const { token: verificationToken, expiresAt: verificationExpiresAt } =
      generateVerificationTokenData();

    // Development-only bypass: Auto-verify emails in non-production
    const isDevelopment = process.env.NODE_ENV === "development";
    let emailSent = false;
    let emailVerified = false;

    // Send verification email FIRST, before saving token
    // Only save token if email is successfully sent
    if (!isDevelopment) {
      try {
        emailSent = await sendVerificationEmail(
          creds.email,
          creds.name,
          verificationToken
        );
        if (!emailSent) {
          console.error(
            "[REGISTER] Email verification email failed to send, token NOT saved",
            { email: creds.email }
          );
          return Response.json(
            { error: "Failed to send verification email. Please try again." },
            { status: 500 }
          );
        }
        console.log("[REGISTER] Verification email sent successfully", {
          email: creds.email,
        });
      } catch (error) {
        // Email send failed - do NOT save token
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          "[REGISTER] Email verification email send failed, token NOT saved",
          { email: creds.email, error: errorMessage }
        );
        return Response.json(
          { error: "Failed to send verification email. Please try again." },
          { status: 500 }
        );
      }
    } else {
      // Development: Auto-verify and log
      emailVerified = true;
      emailSent = true; // Treat as sent for dev bypass
      console.log(
        "[REGISTER] [DEV] Auto-verifying email (development mode)",
        { email: creds.email }
      );
    }

    // Create user, tenant, and subscription in a transaction
    // This ensures all-or-nothing: user gets FREE plan automatically
    // Token is ONLY saved if email was successfully sent
    const result = await prisma.$transaction(async (tx) => {
      // Create user with email verification status
      // In development: auto-verify, no token needed
      // In production: emailVerified = false, token saved only if email sent
      const user = await tx.user.create({
        data: {
          name: creds.name,
          email: creds.email,
          passwordHash,
          emailVerified: emailVerified, // true in dev, false in prod
          // Only save token if email was sent successfully
          emailVerificationToken: emailSent ? verificationToken : null,
          emailVerificationExpiresAt: emailSent
            ? verificationExpiresAt
            : null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          createdAt: true,
        },
      });

      // Create tenant for user (one tenant per user)
      const tenant = await tx.tenant.create({
        data: {
          ownerId: user.id,
          name: `Company of ${user.email}`,
        },
        select: { id: true },
      });

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

      return user;
    });

    // Generate JWT token
    const token = signToken({ userId: result.id, email: result.email });

    // Return success response with auth cookie
    return new Response(JSON.stringify({ ok: true, user: result }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": buildAuthCookie(token),
      },
    });
  } catch (error) {
    // Handle Prisma unique constraint violation (race condition)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return badRequest("User already exists");
    }
    
    // Handle Prisma connection errors
    if (
      error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientKnownRequestError
    ) {
      const isDev = process.env.NODE_ENV === "development";
      if (isDev) {
        console.error("Database error:", error);
        return Response.json(
          { 
            error: `Database connection failed: ${error.message}. Please check your DATABASE_URL in .env.local` 
          },
          { status: 500 }
        );
      }
      return Response.json(
        { error: "Server configuration error: Database connection failed" },
        { status: 500 }
      );
    }
    
    // Log error details in development for debugging
    if (process.env.NODE_ENV === "development") {
      console.error("Register error:", error);
      // Check for common issues
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes("jwt_secret")) {
          return Response.json(
            { error: "Server configuration error: Missing JWT_SECRET" },
            { status: 500 }
          );
        }
        if (
          errorMsg.includes("database") || 
          errorMsg.includes("connection") ||
          errorMsg.includes("can't reach") ||
          errorMsg.includes("connect econnrefused") ||
          errorMsg.includes("authentication failed")
        ) {
          return Response.json(
            { 
              error: `Database connection failed: ${error.message}. Please verify your DATABASE_URL in .env.local` 
            },
            { status: 500 }
          );
        }
        return Response.json(
          { error: `Server error: ${error.message}` },
          { status: 500 }
        );
      }
    }
    
    // Avoid leaking internal details; keep errors generic for production
    return internalError();
  }
}


