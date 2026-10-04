// purge-recent-bots.js
// Targets an ACTIVE bot burst: unverified + zero activity + created within
// a recent lookback window (default 72h) — no 7-day wait like
// cleanup-dead-accounts.js's Tier 1, because a same-day flood doesn't need
// a week to prove itself fake.
//
// Verified accounts are NEVER auto-deleted by this script, even if they
// look bot-shaped and fall in the window — those print in a separate
// "REVIEW" list for you to eyeball / ban-emails-batch.js manually.
//
// Does NOT delete anything by default.
//
// Usage:
//   node purge-recent-bots.js                 (dry run, last 72h)
//   node purge-recent-bots.js 24               (dry run, last 24h)
//   node purge-recent-bots.js 24 --confirm     (actually deletes matches)

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const EXCLUDED_EMAILS = ["apple@test.com", "test@google.com"];

const args = process.argv.slice(2);
const shouldDelete = args.includes("--confirm");
const HOURS = Number(args.find((a) => /^\d+$/.test(a))) || 72;

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

// Same cascade order as deleteAccount in auth.controller.js / cleanup-dead-accounts.js.
async function deleteUserCascade(userId) {
  await prisma.carShowAttendee.deleteMany({ where: { userId } });
  await prisma.carShow.deleteMany({ where: { userId } });
  await prisma.message.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } });
  await prisma.conversation.deleteMany({ where: { OR: [{ user1Id: userId }, { user2Id: userId }] } });
  await prisma.part.deleteMany({ where: { userId } });
  await prisma.notification.deleteMany({ where: { OR: [{ recipientId: userId }, { actorId: userId }] } });
  await prisma.report.deleteMany({ where: { reporterId: userId } });
  await prisma.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
  await prisma.like.deleteMany({ where: { userId } });
  await prisma.comment.deleteMany({ where: { userId } });
  await prisma.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } });
  await prisma.bid.deleteMany({ where: { OR: [{ mechanicId: userId }, { job: { userId } }] } });
  await prisma.review.deleteMany({ where: { OR: [{ reviewerId: userId }, { mechanicId: userId }] } });
  await prisma.log.deleteMany({ where: { userId } });
  await prisma.vehicle.deleteMany({ where: { userId } });
  await prisma.post.deleteMany({ where: { userId } });
  await prisma.job.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
}

async function main() {
  const since = new Date(Date.now() - HOURS * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: {
      isAdmin: false,
      isBanned: false,
      email: { notIn: EXCLUDED_EMAILS },
      createdAt: { gte: since },
    },
    select: { id: true, email: true, name: true, emailVerified: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const autoDelete = []; // unverified + zero activity + in window — safe
  const review = [];     // verified but zero activity + in window — eyeball first

  for (const user of users) {
    const activityCount = await getActivityCount(user.id);
    if (activityCount > 0) continue; // has real activity — never touch

    if (!user.emailVerified) {
      autoDelete.push(user);
    } else {
      review.push(user);
    }
  }

  console.log(`\n=== Lookback window: last ${HOURS}h (since ${since.toISOString()}) ===`);
  console.log(`Total signups in window: ${users.length}\n`);

  console.log(`=== AUTO-DELETE CANDIDATES: unverified, zero activity (${autoDelete.length}) ===`);
  autoDelete.forEach((u) => console.log(`  [${u.id}] ${u.email} | name:"${u.name || "—"}" | ${u.createdAt.toISOString()}`));

  console.log(`\n=== MANUAL REVIEW: verified but zero activity (${review.length}) — NOT auto-deleted ===`);
  review.forEach((u) => console.log(`  [${u.id}] ${u.email} | name:"${u.name || "—"}" | ${u.createdAt.toISOString()}`));

  if (shouldDelete && autoDelete.length > 0) {
    console.log(`\n--confirm flag detected. Deleting ${autoDelete.length} account(s)...`);
    let deleted = 0, failed = 0;
    for (const user of autoDelete) {
      try {
        await deleteUserCascade(user.id);
        console.log(`  Deleted [${user.id}] ${user.email}`);
        deleted++;
      } catch (err) {
        console.error(`  FAILED to delete [${user.id}] ${user.email}:`, err.message);
        failed++;
      }
    }
    console.log(`Done. Deleted ${deleted}, failed ${failed}.`);
  } else if (!shouldDelete) {
    console.log("\nDry run only — no accounts deleted. Re-run with --confirm to delete the auto-delete list.");
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("PURGE SCRIPT ERROR:", err);
  await prisma.$disconnect();
  process.exit(1);
});
