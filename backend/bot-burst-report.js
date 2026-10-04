// bot-burst-report.js — READ ONLY. No writes, no deletes.
// Groups recent signups by hour to visualize a bot burst, and flags
// accounts that look automated (rapid succession, no verification,
// no activity, suspicious name/email shape).
//
// Usage: node bot-burst-report.js [hours]
//   hours = lookback window, default 72

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const HOURS = Number(process.argv[2]) || 72;

// Looks like a randomly-generated bot handle: long run of digits, or
// alternating-case gibberish, or a local-part that's mostly digits.
function looksBotty(email, name) {
  const local = (email.split("@")[0] || "");
  const digitRun = (local.match(/\d/g) || []).length;
  const mostlyDigits = digitRun >= Math.ceil(local.length * 0.4) && local.length >= 6;
  const randomLooking = /^[a-z]{2,6}\d{4,}$/i.test(local); // e.g. "kxqm8382"
  const noName = !name || name.trim() === "" || /^user\d+$/i.test(name.trim());
  return { mostlyDigits, randomLooking, noName, flagged: mostlyDigits || randomLooking };
}

async function main() {
  const since = new Date(Date.now() - HOURS * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, email: true, name: true, role: true,
      emailVerified: true, hasCompletedOnboarding: true,
      isBanned: true, createdAt: true,
      _count: {
        select: {
          posts: true, comments: true, likes: true, messagesSent: true,
          jobsPosted: true, bids: true, vehicles: true, following: true,
        },
      },
    },
  });

  console.log(`\n══════════ SIGNUP BURST REPORT (last ${HOURS}h) ══════════`);
  console.log(`Total signups in window: ${users.length}\n`);

  // Bucket by hour
  const buckets = {};
  for (const u of users) {
    const key = u.createdAt.toISOString().slice(0, 13) + ":00"; // YYYY-MM-DDTHH:00
    buckets[key] = (buckets[key] || 0) + 1;
  }
  const sortedBuckets = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(1, ...Object.values(buckets));
  for (const [hour, count] of sortedBuckets) {
    const bar = "█".repeat(Math.round((count / max) * 40));
    console.log(`${hour}  ${String(count).padStart(4)}  ${bar}`);
  }

  console.log("\n───── Per-account detail ─────");
  let flaggedCount = 0;
  for (const u of users) {
    const c = u._count;
    const activity = c.posts + c.comments + c.likes + c.messagesSent + c.jobsPosted + c.bids + c.vehicles + c.following;
    const sig = looksBotty(u.email, u.name);
    if (sig.flagged) flaggedCount++;
    const tag = sig.flagged ? "🤖BOT-SHAPE" : "  ";
    console.log(
      `${tag} #${u.id} | ${u.createdAt.toISOString()} | ${u.emailVerified ? "✓verify" : "✗verify"} | ` +
      `${u.hasCompletedOnboarding ? "✓onboard" : "✗onboard"} | ${u.isBanned ? "BANNED" : "active"} | ` +
      `act:${activity} | ${u.role} | name:"${u.name || "—"}" | ${u.email}`
    );
  }

  console.log(`\n${flaggedCount} of ${users.length} recent signups have a bot-shaped email/name.`);
  console.log("This is a READ-ONLY report — nothing was changed.");
  console.log("Next: run 'node purge-recent-bots.js' (dry run) to see deletion candidates.\n");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
