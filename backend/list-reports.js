// list-reports.js — READ ONLY. No writes, no deletes.
// Lists submitted reports (post/job) with reporter details, cross-referenced
// against the same bot-shape heuristic used in bot-burst-report.js, so you
// can quickly see whether a report came from a likely-bot account.
//
// Usage:
//   node list-reports.js            (last 30 days)
//   node list-reports.js 7          (last 7 days)
//   node list-reports.js all        (everything, no window)

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const arg = process.argv[2];
const ALL = arg === "all";
const DAYS = ALL ? null : Number(arg) || 30;

// Same heuristic as bot-burst-report.js — kept in sync intentionally.
function looksBotty(email, name) {
  const local = (email.split("@")[0] || "");
  const digitRun = (local.match(/\d/g) || []).length;
  const mostlyDigits = digitRun >= Math.ceil(local.length * 0.4) && local.length >= 6;
  const randomLooking = /^[a-z]{2,6}\d{4,}$/i.test(local); // e.g. "kxqm8382"
  return mostlyDigits || randomLooking;
}

async function main() {
  const where = ALL
    ? {}
    : { createdAt: { gte: new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000) } };

  const reports = await prisma.report.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      reporter: {
        select: { id: true, email: true, name: true, emailVerified: true, createdAt: true, role: true, isBanned: true },
      },
      post: { select: { id: true, content: true, userId: true } },
      job: { select: { id: true, title: true, userId: true } },
    },
  });

  console.log(`\n══════════ REPORTS (${ALL ? "all time" : `last ${DAYS}d`}) ══════════`);
  console.log(`Total: ${reports.length}\n`);

  for (const r of reports) {
    const bot = looksBotty(r.reporter.email, r.reporter.name);
    const tag = bot ? "🤖BOT-SHAPE" : "  ";
    const target = r.post
      ? `POST #${r.post.id} (owner ${r.post.userId}): "${(r.post.content || "").slice(0, 50)}${(r.post.content || "").length > 50 ? "..." : ""}"`
      : r.job
      ? `JOB #${r.job.id} (owner ${r.job.userId}): "${r.job.title}"`
      : "unknown target";

    console.log(
      `${tag} report #${r.id} | ${r.createdAt.toISOString()} | reporter #${r.reporter.id} ${r.reporter.email} ` +
      `(${r.reporter.emailVerified ? "✓verify" : "✗verify"}${r.reporter.isBanned ? ", BANNED" : ""}, acct created ${r.reporter.createdAt.toISOString()}) | ` +
      `reason: "${r.reason}" | target: ${target}`
    );
  }

  console.log(`\n${reports.length} report(s) listed. This is a READ-ONLY report — nothing was changed.\n`);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
