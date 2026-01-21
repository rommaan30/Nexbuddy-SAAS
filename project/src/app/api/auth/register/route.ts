import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { buildAuthCookie } from "@/lib/auth/cookies";
import { signToken } from "@/lib/auth/jwt";
import { parseAuthCredentials } from "@/lib/auth/validators";
import { badRequest, internalError } from "@/lib/http/errors";

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
    const existing = await prisma.user.findUnique({
      where: { email: creds.email },
      select: { id: true },
    });
    if (existing) return badRequest("User already exists");

    const passwordHash = await bcrypt.hash(creds.password, 12);

    const user = await prisma.user.create({
      data: {
        email: creds.email,
        passwordHash,
      },
      select: { id: true, email: true, createdAt: true },
    });

    const token = signToken({ userId: user.id, email: user.email });

    return new Response(JSON.stringify({ ok: true, user }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": buildAuthCookie(token),
      },
    });
  } catch {
    // Avoid leaking internal details; keep errors generic for production.
    return internalError();
  }
}


