import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readAuthTokenFromCookieHeader } from "@/lib/auth/cookies";
import { verifyToken } from "@/lib/auth/jwt";
import { generateVerificationTokenData } from "@/lib/email/verification";
import { sendVerificationEmail } from "@/lib/email/verification";
import { internalError } from "@/lib/http/errors";

/**
 * POST /api/auth/resend-verification
 * 
 * Resends verification email to logged-in, unverified user.
 * Rate-limited: Only allows resend if previous token expired or after 5 minutes.
 */
export async function POST(req: Request) {
  try {
    // Auth: Must be logged in
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

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        emailVerificationExpiresAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { ok: true, message: "Email already verified" },
        { status: 200 }
      );
    }

    // Environment-aware rate limiting
    // Production: 24-hour cooldown with 5-minute threshold
    // Development: 1-minute cooldown with no threshold (for faster testing)
    const isDevelopment = process.env.NODE_ENV === "development";
    const cooldownThresholdMinutes = isDevelopment ? 0 : 5; // No threshold in dev, 5 min in prod

    const now = new Date();
    if (
      user.emailVerificationExpiresAt &&
      user.emailVerificationExpiresAt > now
    ) {
      const minutesRemaining = Math.ceil(
        (user.emailVerificationExpiresAt.getTime() - now.getTime()) /
          (1000 * 60)
      );
      if (minutesRemaining > cooldownThresholdMinutes) {
        const waitMinutes = minutesRemaining - cooldownThresholdMinutes;
        return NextResponse.json(
          {
            error: `Please wait before requesting a new verification email. You can request a new one in ${waitMinutes} minute${waitMinutes !== 1 ? "s" : ""}.`,
          },
          { status: 429 }
        );
      }
    }

    // Generate new verification token
    const { token: verificationToken, expiresAt: verificationExpiresAt } =
      generateVerificationTokenData();

    // Send verification email FIRST, before saving token
    // Only save token if email is successfully sent
    let emailSent = false;
    try {
      emailSent = await sendVerificationEmail(
        user.email,
        user.name,
        verificationToken
      );
      if (!emailSent) {
        console.error(
          "[RESEND] Email verification email failed to send, token NOT saved",
          { userId: user.id, email: user.email }
        );
        return NextResponse.json(
          { error: "Failed to send verification email. Please try again." },
          { status: 500 }
        );
      }
      console.log("[RESEND] Verification email sent successfully", {
        userId: user.id,
        email: user.email,
      });
    } catch (error) {
      // Email send failed - do NOT save token
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        "[RESEND] Email verification email send failed, token NOT saved",
        { userId: user.id, email: user.email, error: errorMessage }
      );
      return NextResponse.json(
        { error: "Failed to send verification email. Please try again." },
        { status: 500 }
      );
    }

    // Only update user with new token if email was successfully sent
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpiresAt: verificationExpiresAt,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Verification email sent",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return internalError();
  }
}
