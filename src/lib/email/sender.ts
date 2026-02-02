/**
 * Email sending utility
 * 
 * Supports multiple providers:
 * - SMTP (via nodemailer)
 * - Resend API
 * - SendGrid API
 * - AWS SES API
 * 
 * Configure via environment variables:
 * - EMAIL_PROVIDER: "smtp" | "resend" | "sendgrid" | "ses"
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (for SMTP)
 * - RESEND_API_KEY (for Resend)
 * - SENDGRID_API_KEY (for SendGrid)
 * - AWS_SES_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (for SES)
 */

type EmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail(options: EmailOptions): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER || "smtp";

  switch (provider) {
    case "smtp":
      return sendViaSMTP(options);
    case "resend":
      return sendViaResend(options);
    case "sendgrid":
      return sendViaSendGrid(options);
    case "ses":
      return sendViaSES();
    default:
      throw new Error(`Unsupported email provider: ${provider}`);
  }
}

async function sendViaSMTP(options: EmailOptions): Promise<void> {
  // For now, use a simple console log in development
  // In production, you would use nodemailer
  if (process.env.NODE_ENV === "development") {
    console.log("📧 [DEV] Email would be sent via SMTP:");
    console.log("To:", options.to);
    console.log("Subject:", options.subject);
    console.log("HTML:", options.html);
    return;
  }

  // Production: Use nodemailer
  // This requires: npm install nodemailer @types/nodemailer
  const nodemailer = await import("nodemailer");
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}

async function sendViaResend(options: EmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required for Resend provider");
  }

  if (process.env.NODE_ENV === "development") {
    console.log("📧 [DEV] Email would be sent via Resend:");
    console.log("To:", options.to);
    console.log("Subject:", options.subject);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "onboarding@resend.dev",
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }
}

async function sendViaSendGrid(options: EmailOptions): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY is required for SendGrid provider");
  }

  if (process.env.NODE_ENV === "development") {
    console.log("📧 [DEV] Email would be sent via SendGrid:");
    console.log("To:", options.to);
    console.log("Subject:", options.subject);
    return;
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: options.to }] }],
      from: { email: process.env.SENDGRID_FROM || "noreply@example.com" },
      subject: options.subject,
      content: [
        { type: "text/html", value: options.html },
        ...(options.text ? [{ type: "text/plain", value: options.text }] : []),
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SendGrid API error: ${error}`);
  }
}

async function sendViaSES(): Promise<void> {
  // AWS SES requires AWS SDK
  // This is a placeholder - implement with @aws-sdk/client-ses
  throw new Error("SES provider not yet implemented. Use SMTP, Resend, or SendGrid.");
}
