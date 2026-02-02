import { PrismaClient, PlanCode } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.plan.upsert({
    where: { code: PlanCode.FREE },
    update: {},
    create: {
      code: PlanCode.FREE,
      name: "Free",
      priceMonthly: 0,
      stripePriceId: null,
    },
  });

  await prisma.plan.upsert({
    where: { code: PlanCode.BASIC },
    update: {},
    create: {
      code: PlanCode.BASIC,
      name: "Basic",
      priceMonthly: 999,
      stripePriceId: "price_1Sq9ekPrwUd2WNygTG4EDh58",
    },
  });

  await prisma.plan.upsert({
    where: { code: PlanCode.ADVANCED },
    update: {},
    create: {
      code: PlanCode.ADVANCED,
      name: "Advanced",
      priceMonthly: 1499,
      stripePriceId: "price_1Sq9hdPrwUd2WNygpbOESJ3X",
    },
  });

  await prisma.plan.upsert({
    where: { code: PlanCode.PRO },
    update: {},
    create: {
      code: PlanCode.PRO,
      name: "Pro",
      priceMonthly: 2499,
      stripePriceId: "price_1Sq9jAPrwUd2WNyg5kZ2eprV",
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
