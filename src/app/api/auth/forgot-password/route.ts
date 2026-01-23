import { prisma } from "@/lib/prisma";
import { badRequest, internalError } from "@/lib/http/errors";

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

  if (typeof email !== "string" || !email.trim()) {
    return badRequest("Email is required");
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail.includes("@") || normalizedEmail.length < 3) {
    return badRequest("Invalid email address");
  }

  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    // Return error if user not found
    if (!user) {
      return badRequest("Email not found");
    }

    // Return success - user can now reset password
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return internalError();
  }
}
