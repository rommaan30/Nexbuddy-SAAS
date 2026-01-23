import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/http/errors";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return unauthorized();
  }

  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { id: true } } },
    });

    if (!resetToken) {
      return unauthorized();
    }

    // Check if token has expired
    if (resetToken.expiresAt < new Date()) {
      // Delete expired token
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });
      return unauthorized();
    }

    return Response.json({ ok: true });
  } catch {
    return unauthorized();
  }
}
