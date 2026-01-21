import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { buildAuthCookie } from "@/lib/auth/cookies";
import { signToken } from "@/lib/auth/jwt";
import { parseAuthCredentials } from "@/lib/auth/validators";
import { badRequest, internalError, unauthorized } from "@/lib/http/errors";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const creds = parseAuthCredentials(body);
  if (!creds) return badRequest("Invalid email or password");

  try {
    const user = await prisma.user.findUnique({
      where: { email: creds.email },
      select: { id: true, email: true, passwordHash: true, createdAt: true },
    });

    if (!user) return unauthorized("Invalid credentials");

    const ok = await bcrypt.compare(creds.password, user.passwordHash);
    if (!ok) return unauthorized("Invalid credentials");

    const token = signToken({ userId: user.id, email: user.email });

    return new Response(
      JSON.stringify({
        ok: true,
        user: { id: user.id, email: user.email, createdAt: user.createdAt },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": buildAuthCookie(token),
        },
      },
    );
  } catch {
    return internalError();
  }
}


