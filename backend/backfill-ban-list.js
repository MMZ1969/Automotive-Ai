// backfill-ban-list.js — one-time: put every already-banned account's email on
// the signup ban list (BannedEmail). Before 2026-10-21 the in-app Ban button
// only set isBanned. Safe to re-run; skips addresses already listed.
//
// Usage:  node backfill-ban-list.js            (dry run: shows what it would add)
//         node backfill-ban-list.js --confirm  (writes)
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CONFIRM = process.argv.includes("--confirm");

async function main() {
  const banned = await prisma.user.findMany({ where: { isBanned: true }, select: { email: true } });
  const listed = new Set((await prisma.bannedEmail.findMany({ select: { email: true } })).map((b) => b.email.toLowerCase()));
  const toAdd = [...new Set(banned.map((u) => u.email.toLowerCase().trim()))].filter((e) => !listed.has(e));

  console.log(`${banned.length} banned account(s), ${toAdd.length} not yet on the ban list${CONFIRM ? "" : " (dry run)"}:`);
  toAdd.forEach((e) => console.log(`   ${e}`));
  if (!CONFIRM || !toAdd.length) {
    if (!CONFIRM && toAdd.length) console.log("\nRe-run with --confirm to add them.");
    return;
  }
  const { count } = await prisma.bannedEmail.createMany({
    data: toAdd.map((email) => ({ email, reason: "Backfill: banned in app" })),
    skipDuplicates: true,
  });
  console.log(`\nAdded ${count}.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
