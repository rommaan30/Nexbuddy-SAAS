import { prisma } from "@/lib/prisma";
import { readAuthTokenFromCookieHeader } from "@/lib/auth/cookies";
import { verifyToken } from "@/lib/auth/jwt";
import { internalError, unauthorized } from "@/lib/http/errors";

export async function GET(req: Request) {
  const token = readAuthTokenFromCookieHeader(req.headers.get("cookie"));
  if (!token) return unauthorized();

  try {
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, createdAt: true },
    });

    if (!user) return unauthorized();

    return Response.json({ ok: true, user });
  } catch {
    return internalError();
  }
}
