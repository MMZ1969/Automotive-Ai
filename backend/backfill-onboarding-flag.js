// backfill-onboarding-flag.js
// One-time script — sets hasCompletedOnboarding = true for any user
// who already has at least one vehicle. Safe to run multiple times.

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const usersWithVehicles = await prisma.user.findMany({
    where: {
      vehicles: { some: {} },
      hasCompletedOnboarding: false,
    },
    select: { id: true, email: true },
  });

  console.log(`Found ${usersWithVehicles.length} user(s) with vehicles but hasCompletedOnboarding still false.`);

  for (const user of usersWithVehicles) {
    await prisma.user.update({
      where: { id: user.id },
      data: { hasCompletedOnboarding: true },
    });
    console.log(`  Backfilled [${user.id}] ${user.email}`);
  }

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("BACKFILL ERROR:", err);
  await prisma.$disconnect();
  process.exit(1);
});