// backfill-email-normalized.js
// Fills User.emailNormalized for accounts created before the alias guard
// existed, and reports any accounts that already share one inbox
// (e.g. john@gmail.com and j.ohn+2@gmail.com).
//
// Does NOT write anything by default.
//
// Usage:
//   node backfill-email-normalized.js            (dry run: report only)
//   node backfill-email-normalized.js --confirm  (writes emailNormalized)

import { PrismaClient } from "@prisma/client";
import { normalizeEmail } from "./src/lib/emailNormalize.js";

const prisma = new PrismaClient();
const shouldWrite = process.argv.includes("--confirm");

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, emailNormalized: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const groups = {};
  for (const u of users) {
    const n = normalizeEmail(u.email);
    (groups[n] ||= []).push(u);
  }

  const collisions = Object.entries(groups).filter(([, list]) => list.length > 1);
  const toUpdate = users.filter((u) => u.emailNormalized !== normalizeEmail(u.email));

  console.log(`\nTotal users: ${users.length}`);
  console.log(`Need emailNormalized written/updated: ${toUpdate.length}`);
  console.log(`\n=== ACCOUNTS SHARING ONE INBOX (${collisions.length} group(s)) ===`);
  if (collisions.length === 0) console.log("  none");
  for (const [n, list] of collisions) {
    console.log(`  ${n}`);
    list.forEach((u) => console.log(`     #${u.id} ${u.email} (created ${u.createdAt.toISOString().slice(0, 10)})`));
  }

  if (!shouldWrite) {
    console.log("\nDry run only — nothing written. Re-run with --confirm to write emailNormalized.");
  } else {
    let done = 0;
    for (const u of toUpdate) {
      await prisma.user.update({ where: { id: u.id }, data: { emailNormalized: normalizeEmail(u.email) } });
      done++;
    }
    console.log(`\nWrote emailNormalized for ${done} user(s).`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("BACKFILL ERROR:", err);
  await prisma.$disconnect();
  process.exit(1);
});
