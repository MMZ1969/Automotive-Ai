// cleanup-dead-accounts.js
// Standalone dry-run script — identifies dead/dormant accounts for review.
// Does NOT delete anything by default. Run with --confirm to actually delete Tier 1.
//
// Usage:
//   node cleanup-dead-accounts.js            (dry run, prints candidates only)
//   node cleanup-dead-accounts.js --confirm  (actually deletes Tier 1 candidates)

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const EXCLUDED_EMAILS = ["apple@test.com", "test@google.com"];
const TIER1_MIN_AGE_DAYS = 7;

async function getActivityCount(userId) {
  const [
    posts, comments, likes, follows, vehicles, logs,
    messagesSent, jobsPosted, bids, reviewsGiven, parts,
    carShows, carShowAttendees,
  ] = await Promise.all([
    prisma.post.count({ where: { userId } }),
    prisma.comment.count({ where: { userId } }),
    prisma.like.count({ where: { userId } }),
    prisma.follow.count({ where: { followerId: userId } }),
    prisma.vehicle.count({ where: { userId } }),
    prisma.log.count({ where: { userId } }),
    prisma.message.count({ where: { senderId: userId } }),
    prisma.job.count({ where: { userId } }),
    prisma.bid.count({ where: { mechanicId: userId } }),
    prisma.review.count({ where: { reviewerId: userId } }),
    prisma.part.count({ where: { userId } }),
    prisma.carShow.count({ where: { userId } }),
    prisma.carShowAttendee.count({ where: { userId } }),
  ]);

  return posts + comments + likes + follows + vehicles + logs +
    messagesSent + jobsPosted + bids + reviewsGiven + parts +
    carShows + carShowAttendees;
}

async function main() {
  const shouldDelete = process.argv.includes("--confirm");

  const users = await prisma.user.findMany({
    where: {
      isAdmin: false,
      email: { notIn: EXCLUDED_EMAILS },
    },
    select: { id: true, email: true, emailVerified: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const tier1 = []; // unverified + old + zero activity — safe to auto-clean
  const tier2 = []; // verified + zero activity — needs manual eyeball

  const cutoff = new Date(Date.now() - TIER1_MIN_AGE_DAYS * 24 * 60 * 60 * 1000);

  for (const user of users) {
    const activityCount = await getActivityCount(user.id);
    if (activityCount > 0) continue; // has real activity, skip entirely

    if (!user.emailVerified && user.createdAt < cutoff) {
      tier1.push(user);
    } else if (user.emailVerified) {
      tier2.push(user);
    }
    // unverified but NOT yet 7 days old -> intentionally ignored (too new to judge)
  }

  console.log("\n=== TIER 1: Unverified, 7+ days old, zero activity (safe to auto-clean) ===");
  console.log(`Found ${tier1.length} candidate(s):\n`);
  tier1.forEach(u => console.log(`  [${u.id}] ${u.email} — created ${u.createdAt.toISOString()}`));

  console.log("\n=== TIER 2: Verified, zero activity (needs manual review) ===");
  console.log(`Found ${tier2.length} candidate(s):\n`);
  tier2.forEach(u => console.log(`  [${u.id}] ${u.email} — created ${u.createdAt.toISOString()}`));

  if (shouldDelete && tier1.length > 0) {
    console.log(`\n--confirm flag detected. Deleting ${tier1.length} Tier 1 account(s)...`);
    for (const user of tier1) {
      await prisma.user.delete({ where: { id: user.id } });
      console.log(`  Deleted [${user.id}] ${user.email}`);
    }
    console.log("Done.");
  } else if (!shouldDelete) {
    console.log("\nDry run only — no accounts deleted. Re-run with --confirm to delete Tier 1 candidates.");
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("CLEANUP SCRIPT ERROR:", err);
  await prisma.$disconnect();
  process.exit(1);
});