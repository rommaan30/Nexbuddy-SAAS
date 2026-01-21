import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { priceMonthly: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        priceMonthly: true,
        stripePriceId: true,
      },
    });
    return Response.json({ ok: true, plans });
  } catch {
    return Response.json({ error: "Failed to load plans" }, { status: 500 });
  }
}


