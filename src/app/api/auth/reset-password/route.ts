import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { badRequest, internalError, unauthorized } from "@/lib/http/errors";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!body || typeof body !== "object") {
    return badRequest("Invalid request body");
  }

  const record = body as Record<string, unknown>;
  const email = record.email;
  const password = record.password;

  if (typeof email !== "string" || !email.trim()) {
    return badRequest("Email is required");
  }

  if (typeof password !== "string" || password.length < 8) {
    return badRequest("Password must be at least 8 characters");
  }

  if (password.length > 128) {
    return badRequest("Password is too long");
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (!user) {
      return badRequest("Email not found");
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user's password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return internalError();
  }
}
