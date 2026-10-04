// referral-report.js — READ ONLY. No writes, no deletes.
// Shows who used whose referral code, and flags patterns that look like
// referral farming:
//   - self-referral via email alias (a+1@gmail.com / a.b@gmail.com style)
//   - bot-shaped referred emails (same heuristic as bot-burst-report.js)
//   - rapid referral bursts (3+ referred signups within 1 hour)
//   - referred accounts that share a normalized email with each other
//
// Usage:
//   node referral-report.js          (all referrers)
//   node referral-report.js flagged  (only referrers with at least one flag)

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const ONLY_FLAGGED = process.argv[2] === "flagged";
const BURST_WINDOW_MS = 60 * 60 * 1000;
const BURST_MIN = 3;

// Same heuristic as bot-burst-report.js — kept in sync intentionally.
function looksBotty(email) {
  const local = (email.split("@")[0] || "");
  const digitRun = (local.match(/\d/g) || []).length;
  const mostlyDigits = digitRun >= Math.ceil(local.length * 0.4) && local.length >= 6;
  const randomLooking = /^[a-z]{2,6}\d{4,}$/i.test(local);
  return mostlyDigits || randomLooking;
}

// Collapse gmail-style aliases: strip +tag everywhere, strip dots for gmail/googlemail.
function normalizeEmail(email) {
  const [localRaw, domainRaw] = email.toLowerCase().split("@");
  if (!domainRaw) return email.toLowerCase();
  let local = localRaw.split("+")[0];
  let domain = domainRaw;
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

async function main() {
  const referrers = await prisma.user.findMany({
    where: { referrals: { some: {} } },
    select: {
      id: true, email: true, name: true, repPoints: true, createdAt: true,
      referrals: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true, email: true, name: true, emailVerified: true,
          hasCompletedOnboarding: true, referralRewardGiven: true, createdAt: true,
        },
      },
    },
  });

  referrers.sort((a, b) => b.referrals.length - a.referrals.length);

  console.log(`\n══════════ REFERRAL REPORT ══════════`);
  console.log(`Referrers with at least one referral: ${referrers.length}\n`);

  let flaggedReferrers = 0;

  for (const ref of referrers) {
    const refNorm = normalizeEmail(ref.email);
    const flags = [];

    const normCounts = {};
    for (const r of ref.referrals) {
      const n = normalizeEmail(r.email);
      normCounts[n] = (normCounts[n] || 0) + 1;
    }

    const selfAlias = ref.referrals.filter((r) => normalizeEmail(r.email) === refNorm);
    if (selfAlias.length) flags.push(`SELF-REFERRAL via alias (${selfAlias.length})`);

    const botty = ref.referrals.filter((r) => looksBotty(r.email));
    if (botty.length) flags.push(`${botty.length} bot-shaped referred email(s)`);

    const dupAliases = Object.values(normCounts).filter((c) => c > 1).length;
    if (dupAliases) flags.push(`${dupAliases} referred email(s) collapse to the same inbox`);

    // Burst: any BURST_MIN referrals inside a 1-hour window
    const times = ref.referrals.map((r) => r.createdAt.getTime());
    let burst = false;
    for (let i = 0; i + BURST_MIN - 1 < times.length; i++) {
      if (times[i + BURST_MIN - 1] - times[i] <= BURST_WINDOW_MS) { burst = true; break; }
    }
    if (burst) flags.push(`burst: ${BURST_MIN}+ referred signups within 1h`);

    if (ONLY_FLAGGED && flags.length === 0) continue;
    if (flags.length) flaggedReferrers++;

    const rewarded = ref.referrals.filter((r) => r.referralRewardGiven).length;
    console.log(
      `${flags.length ? "🚩" : "  "} Referrer #${ref.id} ${ref.email} (name:"${ref.name || "—"}", rep:${ref.repPoints}) ` +
      `| referred: ${ref.referrals.length} | rewarded: ${rewarded}`
    );
    if (flags.length) console.log(`     flags: ${flags.join("; ")}`);
    for (const r of ref.referrals) {
      console.log(
        `     → #${r.id} ${r.email} | ${r.createdAt.toISOString()} | ` +
        `${r.emailVerified ? "✓verify" : "✗verify"} | ${r.hasCompletedOnboarding ? "✓onboard" : "✗onboard"} | ` +
        `${r.referralRewardGiven ? "REWARDED" : "no reward"}${looksBotty(r.email) ? " | 🤖BOT-SHAPE" : ""}`
      );
    }
    console.log("");
  }

  console.log(`${flaggedReferrers} of ${referrers.length} referrer(s) have at least one flag.`);
  console.log("This is a READ-ONLY report — nothing was changed.\n");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
