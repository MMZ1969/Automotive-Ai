// signup-quality.js — READ ONLY. Answers "how many of my signups are real?"
//
// Sorts every real account (same exclusions as activity-report.js, plus
// Michael's own people) into one tier by what they actually did:
//   T0 ghost      — signed up, did nothing at all
//   T1 shallow    — only follows/likes (cheap taps; install farms do these)
//   T2 tried it   — added a vehicle and/or ran diagnoses, all on signup day
//   T3 engaged    — posted, commented, messaged, listed a part, saved a
//                   diagnosis, or ran 3+ diagnoses — all on signup day
//   T4 came back  — any action or app open (lastSeenAt) on a later day
//
// Separately flags a JUNK PATTERN on the email (looks like an auto-generated or
// throwaway address). The flag is a hint, not a verdict: plenty of real people
// have jamie8891-style addresses. "Junk" in the summary = pattern AND T0/T1.
//
// Usage:  node signup-quality.js         (last 12 weeks of cohorts)
//         node signup-quality.js 26      (last 26 weeks)
// Output: console + reports/signup-quality.txt
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "fs";

const prisma = new PrismaClient();
const TEST_EMAILS = ["test@google.com", "apple@test.com"];
const OWN_PEOPLE = [6, 8, 69, 100]; // Lauren, Arch, Tony, MAZ — not organic signups
const DAY = 24 * 60 * 60 * 1000;
const WEEKS = Math.max(1, Number(process.argv[2]) || 12);

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : "—");
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
function weekStart(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); // Monday
  return x;
}
async function optional(fn, fallback) {
  try { return await fn(); } catch { return fallback; }
}

const out = [];
const log = (s = "") => { console.log(s); out.push(s); };

// ── Junk-pattern heuristic on the email ─────────────────────────────────────
// Returns a list of reasons (empty = looks normal).
function junkReasons(email, name) {
  const reasons = [];
  const local = String(email || "").split("@")[0].toLowerCase();
  const letters = local.replace(/[^a-z]/g, "");
  const digits = (local.match(/\d/g) || []).length;
  if (/\d{5,}$/.test(local)) reasons.push("5+ trailing digits");
  else if (digits >= 4 && digits / local.length >= 0.35) reasons.push("digit-heavy");
  // Name shares nothing with the address (e.g. name "Khokon", email herolevel2456)
  const nameParts = String(name || "").toLowerCase().split(/[^a-z]+/).filter((p) => p.length >= 3);
  if (nameParts.length && !nameParts.some((p) => letters.includes(p.slice(0, 4)))) {
    if (digits >= 3) reasons.push("name not in email");
  }
  if (!/@/.test(String(email || ""))) reasons.push("no @ (not an email)");
  return reasons;
}

async function main() {
  const now = Date.now();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true, email: true, name: true, role: true, isAdmin: true, isBanned: true,
      emailVerified: true, pushToken: true, totalDiagnoses: true, createdAt: true,
      lastSeenAt: true,
    },
  });
  const real = users.filter((u) =>
    !u.isAdmin && !u.isBanned && !TEST_EMAILS.includes(u.email) && !OWN_PEOPLE.includes(u.id));

  const [posts, comments, likes, messages, vehicles, follows, parts, saved, diagLogs] = await Promise.all([
    prisma.post.findMany({ select: { userId: true, createdAt: true } }),
    prisma.comment.findMany({ select: { userId: true, createdAt: true } }),
    prisma.like.findMany({ select: { userId: true, createdAt: true } }),
    prisma.message.findMany({ select: { senderId: true, createdAt: true } }),
    prisma.vehicle.findMany({ select: { userId: true, createdAt: true } }),
    prisma.follow.findMany({ select: { followerId: true, createdAt: true } }),
    prisma.part.findMany({ select: { userId: true, createdAt: true } }),
    prisma.savedDiagnosis.findMany({ select: { userId: true, createdAt: true } }),
    optional(() => prisma.diagnosisLog.findMany({ select: { userId: true, createdAt: true } }), []),
  ]);

  const events = new Map(); // userId -> [{ at, kind }]
  const add = (id, at, kind) => {
    if (!events.has(id)) events.set(id, []);
    events.get(id).push({ at: new Date(at), kind });
  };
  posts.forEach((r) => add(r.userId, r.createdAt, "post"));
  comments.forEach((r) => add(r.userId, r.createdAt, "comment"));
  likes.forEach((r) => add(r.userId, r.createdAt, "like"));
  messages.forEach((r) => add(r.senderId, r.createdAt, "message"));
  vehicles.forEach((r) => add(r.userId, r.createdAt, "vehicle"));
  follows.forEach((r) => add(r.followerId, r.createdAt, "follow"));
  parts.forEach((r) => add(r.userId, r.createdAt, "part"));
  saved.forEach((r) => add(r.userId, r.createdAt, "saved"));
  diagLogs.forEach((r) => add(r.userId, r.createdAt, "diagnosis"));

  const SHALLOW = new Set(["follow", "like"]);
  const ENGAGED = new Set(["post", "comment", "message", "part", "saved"]);
  const TIERS = ["T0 ghost", "T1 shallow", "T2 tried it", "T3 engaged", "T4 came back"];

  const P = real.map((u) => {
    const ev = events.get(u.id) || [];
    const kinds = {};
    ev.forEach((e) => (kinds[e.kind] = (kinds[e.kind] || 0) + 1));
    // DiagnosisLog started mid-life; older diagnoses only show in totalDiagnoses
    const diagCount = Math.max(kinds.diagnosis || 0, u.totalDiagnoses || 0);
    const signupDay = dayKey(u.createdAt);
    const days = new Set(ev.map((e) => dayKey(e.at)));
    if (u.lastSeenAt) days.add(dayKey(u.lastSeenAt));
    const cameBack = [...days].some((d) => d > signupDay);

    let tier;
    if (cameBack) tier = 4;
    else if (ev.some((e) => ENGAGED.has(e.kind)) || diagCount >= 3) tier = 3;
    else if (kinds.vehicle || diagCount > 0) tier = 2;
    else if (ev.some((e) => SHALLOW.has(e.kind))) tier = 1;
    else tier = 0;

    const reasons = junkReasons(u.email, u.name);
    return { u, kinds, diagCount, tier, reasons, junk: reasons.length > 0 && tier <= 1 };
  });

  // ── 1. Summary ─────────────────────────────────────────────────────────────
  log(`\n══════════ AUTOAI SIGNUP QUALITY — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC ══════════`);
  log(`Accounts: ${users.length} total → ${real.length} organic (excluded admin / review / banned / own people)\n`);
  TIERS.forEach((label, t) => {
    const n = P.filter((p) => p.tier === t).length;
    log(`  ${pad(label, 16)} ${lpad(n, 4)}  ${lpad(pct(n, P.length), 4)}`);
  });
  const flagged = P.filter((p) => p.reasons.length).length;
  const junk = P.filter((p) => p.junk).length;
  const realish = P.filter((p) => p.tier >= 2).length;
  log("");
  log(`  Email matches junk pattern          ${lpad(flagged, 4)}  ${lpad(pct(flagged, P.length), 4)}`);
  log(`  Likely junk (pattern + T0/T1)       ${lpad(junk, 4)}  ${lpad(pct(junk, P.length), 4)}`);
  log(`  Used the product (T2+)              ${lpad(realish, 4)}  ${lpad(pct(realish, P.length), 4)}`);
  log(`  Came back (T4)                      ${lpad(P.filter((p) => p.tier === 4).length, 4)}  ${lpad(pct(P.filter((p) => p.tier === 4).length, P.length), 4)}`);

  // Role split: are junk signups mostly picking Mechanic?
  log("\n  By role             signups   junk   T2+");
  for (const role of ["DIYER", "MECHANIC"]) {
    const r = P.filter((p) => p.u.role === role);
    log(`  ${pad(role, 18)}${lpad(r.length, 8)}${lpad(r.filter((p) => p.junk).length, 7)}${lpad(r.filter((p) => p.tier >= 2).length, 6)}`);
  }

  // ── 2. Weekly cohorts ──────────────────────────────────────────────────────
  log(`\n───── WEEKLY COHORTS (last ${WEEKS} weeks, weeks start Monday UTC) ─────`);
  log(`  ${pad("Week of", 12)}${lpad("Signups", 8)}${lpad("Junk", 6)}${lpad("T0", 5)}${lpad("T1", 5)}${lpad("T2", 5)}${lpad("T3", 5)}${lpad("T4", 5)}${lpad("T2+ %", 8)}`);
  const firstWeek = weekStart(now - (WEEKS - 1) * 7 * DAY);
  for (let w = new Date(firstWeek); w.getTime() <= now; w = new Date(w.getTime() + 7 * DAY)) {
    const c = P.filter((p) => weekStart(p.u.createdAt).getTime() === w.getTime());
    const t = (n) => c.filter((p) => p.tier === n).length;
    log(
      `  ${pad(dayKey(w), 12)}${lpad(c.length, 8)}${lpad(c.filter((p) => p.junk).length, 6)}` +
      `${lpad(t(0), 5)}${lpad(t(1), 5)}${lpad(t(2), 5)}${lpad(t(3), 5)}${lpad(t(4), 5)}` +
      `${lpad(pct(c.filter((p) => p.tier >= 2).length, c.length), 8)}`
    );
  }
  const older = P.filter((p) => p.u.createdAt < firstWeek);
  if (older.length) log(`  (+${older.length} organic users who signed up before ${dayKey(firstWeek)})`);

  // ── 3. Every account, grouped by tier ──────────────────────────────────────
  for (let t = 4; t >= 0; t--) {
    const group = P.filter((p) => p.tier === t).sort((a, b) => b.u.createdAt - a.u.createdAt);
    if (!group.length) continue;
    log(`\n───── ${TIERS[t]} (${group.length}) ─────`);
    group.forEach((p) => {
      const k = Object.entries(p.kinds).filter(([kk]) => kk !== "diagnosis").map(([kk, v]) => `${kk}:${v}`);
      if (p.diagCount) k.push(`diagnosis:${p.diagCount}`);
      log(
        `  #${pad(p.u.id, 5)}${pad(p.u.role, 9)}joined ${dayKey(p.u.createdAt)}  ` +
        `${p.u.emailVerified ? "✓" : "✗"}verified  push ${p.u.pushToken ? "✓" : "✗"}  ` +
        `${pad(p.u.name || "—", 18)} ${pad(p.u.email, 34)} ${pad(k.join(" ") || "nothing", 28)}` +
        `${p.reasons.length ? `  ⚑ ${p.reasons.join(", ")}` : ""}`
      );
    });
  }
  log("\n⚑ = email matches the junk pattern. A flag on a T2+ user is just an odd address, not junk.");
  log("");

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/signup-quality.txt", out.join("\n"));
  console.log("Saved → reports/signup-quality.txt");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
