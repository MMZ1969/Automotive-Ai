// delete-user.js
// Fully deletes one or more users and all their related data in one
// transaction per user (all-or-nothing). Uses the same routine as the
// in-app "Delete Account": src/lib/deleteUserData.js.
//
// Usage:
//   node delete-user.js 12 48 89

import { PrismaClient } from "@prisma/client";
import { deleteUserData } from "./src/lib/deleteUserData.js";

const prisma = new PrismaClient();

async function main() {
  const ids = process.argv.slice(2).map(Number).filter((n) => !isNaN(n));

  if (ids.length === 0) {
    console.log("Usage: node delete-user.js <userId> [userId2] [userId3] ...");
    process.exit(1);
  }

  for (const id of ids) {
    try {
      const user = await prisma.user.findUnique({ where: { id }, select: { email: true } });
      if (!user) {
        console.log(`[${id}] No user found — skipping.`);
        continue;
      }
      await deleteUserData(prisma, id);
      console.log(`[${id}] Deleted ${user.email}`);
    } catch (err) {
      console.error(`[${id}] FAILED:`, err.message);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("SCRIPT ERROR:", err);
  await prisma.$disconnect();
  process.exit(1);
});
