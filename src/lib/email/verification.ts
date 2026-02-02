import { generateVerificationToken, getTokenExpiry } from "./token";
import { sendEmail } from "./sender";

/**
 * Send email verification email to user
 * @returns true if email was sent successfully, throws error on failure
 * @throws Error if email sending fails
 */
export async function sendVerificationEmail(
  email: string,
  name: string | null,
  token: string
): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verificationUrl = `${appUrl}/verify-email?token=${token}`;

  const displayName = name || email.split("@")[0];

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <h1 style="margin: 0 0 16px 0; font-size: 24px; color: #111827;">Verify your email address</h1>
          <p style="margin: 0 0 16px 0; color: #6b7280;">Hi ${displayName},</p>
          <p style="margin: 0 0 24px 0; color: #6b7280;">Thanks for signing up! Please verify your email address by clicking the button below:</p>
          <a href="${verificationUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; margin-bottom: 24px;">Verify Email Address</a>
          <p style="margin: 24px 0 0 0; font-size: 14px; color: #9ca3af;">Or copy and paste this link into your browser:</p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280; word-break: break-all;">${verificationUrl}</p>
          <p style="margin: 24px 0 0 0; font-size: 14px; color: #9ca3af;">This link will expire in 24 hours.</p>
        </div>
        <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">If you didn't create an account, you can safely ignore this email.</p>
      </body>
    </html>
  `;

  const text = `
Verify your email address

Hi ${displayName},

Thanks for signing up! Please verify your email address by visiting this link:

${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.
  `.trim();

  try {
    await sendEmail({
      to: email,
      subject: "Verify your email address",
      html,
      text,
    });
    return true;
  } catch (error) {
    // Re-throw with context for better error handling
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to send verification email: ${errorMessage}`);
  }
}

/**
 * Generate verification token and expiry
 */
export function generateVerificationTokenData() {
  return {
    token: generateVerificationToken(),
    expiresAt: getTokenExpiry(24), // 24 hours
  };
}
