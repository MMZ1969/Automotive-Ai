// activity-report.js — READ ONLY. Answers "do I actually have users?"
//
// Excludes admins, Apple/Google review accounts and banned accounts, then shows:
//   1. Funnel: verified email, onboarding, push token, ever did anything, active lately
//   2. Weekly signup cohorts: activated, came back on a later day
//   3. Whether anyone engages with posts (real users' and yours)
//   4. Whether messages get replies, and unread messages piling up
//   5. Every real user with their last sign of life
//
// "Activity" = things people DO (post, comment, like, message, add vehicle/log,
// follow, job, bid, part, car show, diagnosis). Opening the app and only reading
// is invisible except through lastSeenAt (tracked from 2026-10-15 on).
//
// Usage:  node activity-report.js            (last 12 weeks of cohorts)
//         node activity-report.js 26         (last 26 weeks)
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TEST_EMAILS = ["test@google.com", "apple@test.com"];
const DAY = 24 * 60 * 60 * 1000;
const WEEKS = Math.max(1, Number(process.argv[2]) || 12);

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const fmt = (d) => (d ? dayKey(d) : "—");
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

async function main() {
  const now = Date.now();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true, email: true, name: true, role: true, isAdmin: true, isBanned: true,
      emailVerified: true, hasCompletedOnboarding: true, pushToken: true,
      totalDiagnoses: true, lastDiagnosisDate: true, createdAt: true,
    },
  });
  // lastSeenAt only exists after the 2026-10-15 schema push
  const seenRows = await optional(
    () => prisma.user.findMany({ select: { id: true, lastSeenAt: true } }), []);
  const lastSeen = new Map(seenRows.map((r) => [r.id, r.lastSeenAt]));

  const byId = new Map(users.map((u) => [u.id, u]));
  const isReal = (id) => {
    const u = byId.get(id);
    return !!u && !u.isAdmin && !u.isBanned && !TEST_EMAILS.includes(u.email);
  };
  const isAdmin = (id) => !!byId.get(id)?.isAdmin;
  const real = users.filter((u) => isReal(u.id));

  // ── Gather every dated action ────────────────────────────────────────────
  const [posts, comments, likes, messages, vehicles, logs, follows, jobs, bids, parts,
    saved, shows, attend, reviews, diagLogs] = await Promise.all([
    prisma.post.findMany({ select: { id: true, userId: true, createdAt: true } }),
    prisma.comment.findMany({ select: { userId: true, postId: true, createdAt: true } }),
    prisma.like.findMany({ select: { userId: true, postId: true, createdAt: true } }),
    prisma.message.findMany({
      orderBy: { createdAt: "asc" },
      select: { conversationId: true, senderId: true, receiverId: true, read: true, createdAt: true },
    }),
    prisma.vehicle.findMany({ select: { userId: true, createdAt: true } }),
    prisma.log.findMany({ select: { userId: true, createdAt: true } }),
    prisma.follow.findMany({ select: { followerId: true, createdAt: true } }),
    prisma.job.findMany({ select: { userId: true, createdAt: true } }),
    prisma.bid.findMany({ select: { mechanicId: true, createdAt: true } }),
    prisma.part.findMany({ select: { userId: true, createdAt: true } }),
    prisma.savedDiagnosis.findMany({ select: { userId: true, createdAt: true } }),
    prisma.carShow.findMany({ select: { userId: true, createdAt: true } }),
    prisma.carShowAttendee.findMany({ select: { userId: true, createdAt: true } }),
    prisma.review.findMany({ select: { reviewerId: true, createdAt: true } }),
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
  logs.forEach((r) => add(r.userId, r.createdAt, "log"));
  follows.forEach((r) => add(r.followerId, r.createdAt, "follow"));
  jobs.forEach((r) => add(r.userId, r.createdAt, "job"));
  bids.forEach((r) => add(r.mechanicId, r.createdAt, "bid"));
  parts.forEach((r) => add(r.userId, r.createdAt, "part"));
  saved.forEach((r) => add(r.userId, r.createdAt, "diagnosis"));
  shows.forEach((r) => add(r.userId, r.createdAt, "carshow"));
  attend.forEach((r) => add(r.userId, r.createdAt, "carshow"));
  reviews.forEach((r) => add(r.reviewerId, r.createdAt, "review"));
  diagLogs.forEach((r) => add(r.userId, r.createdAt, "diagnosis"));
  users.forEach((u) => u.lastDiagnosisDate && add(u.id, u.lastDiagnosisDate, "diagnosis"));

  const profile = (u) => {
    const ev = (events.get(u.id) || []).sort((a, b) => a.at - b.at);
    const seen = lastSeen.get(u.id) || null;
    const signupDay = dayKey(u.createdAt);
    const activeDays = new Set(ev.map((e) => dayKey(e.at)));
    if (seen) activeDays.add(dayKey(seen));
    const lastAction = ev.length ? ev[ev.length - 1].at : null;
    const lastSign = [lastAction, seen].filter(Boolean).sort((a, b) => b - a)[0] || null;
    const kinds = {};
    ev.forEach((e) => (kinds[e.kind] = (kinds[e.kind] || 0) + 1));
    return {
      u, ev, kinds, lastAction, lastSign, seen,
      activated: ev.length > 0 || u.totalDiagnoses > 0,
      activatedWeek1: ev.some((e) => e.at - u.createdAt < 7 * DAY) || (u.totalDiagnoses > 0 && !ev.length),
      cameBack: [...activeDays].some((d) => d !== signupDay),
    };
  };
  const P = real.map(profile);

  // ── 1. Funnel ────────────────────────────────────────────────────────────
  const excluded = users.length - real.length;
  const within = (p, days) => p.lastSign && now - p.lastSign.getTime() < days * DAY;
  console.log(`\n══════════ AUTOAI ACTIVITY REPORT — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC ══════════`);
  console.log(`Accounts: ${users.length} total, ${excluded} excluded (admin / review / banned) → ${real.length} real\n`);
  const row = (label, n) => console.log(`  ${pad(label, 44)} ${lpad(n, 4)}  ${lpad(pct(n, real.length), 4)}`);
  row("Verified email", real.filter((u) => u.emailVerified).length);
  row("Completed onboarding", real.filter((u) => u.hasCompletedOnboarding).length);
  row("Has a push token (can receive notifications)", real.filter((u) => u.pushToken).length);
  row("Ever did anything", P.filter((p) => p.activated).length);
  row("Came back on a later day", P.filter((p) => p.cameBack).length);
  row("Any sign of life in last 7 days", P.filter((p) => within(p, 7)).length);
  row("Any sign of life in last 30 days", P.filter((p) => within(p, 30)).length);
  if (!seenRows.some((r) => r.lastSeenAt)) console.log("  (lastSeenAt not tracked yet: app opens without an action are invisible)");

  // ── 2. Weekly cohorts ────────────────────────────────────────────────────
  console.log(`\n───── SIGNUP COHORTS (last ${WEEKS} weeks, weeks start Monday UTC) ─────`);
  console.log(`  ${pad("Week of", 12)}${lpad("Signups", 8)}${lpad("Did sth", 9)}${lpad("<7d", 6)}${lpad("Returned", 10)}${lpad("Alive 14d", 11)}`);
  const firstWeek = weekStart(now - (WEEKS - 1) * 7 * DAY);
  for (let w = new Date(firstWeek); w.getTime() <= now; w = new Date(w.getTime() + 7 * DAY)) {
    const c = P.filter((p) => weekStart(p.u.createdAt).getTime() === w.getTime());
    console.log(
      `  ${pad(dayKey(w), 12)}${lpad(c.length, 8)}${lpad(c.filter((p) => p.activated).length, 9)}` +
      `${lpad(c.filter((p) => p.activatedWeek1).length, 6)}${lpad(c.filter((p) => p.cameBack).length, 10)}` +
      `${lpad(c.filter((p) => within(p, 14)).length, 11)}`
    );
  }
  const older = P.filter((p) => p.u.createdAt < firstWeek);
  if (older.length) console.log(`  (+${older.length} real users who signed up before ${dayKey(firstWeek)})`);

  // ── 3. Post engagement ───────────────────────────────────────────────────
  const postOwner = new Map(posts.map((p) => [p.id, p.userId]));
  const engagers = new Map(); // postId -> Set(userId) excluding author
  [...comments, ...likes].forEach((r) => {
    if (r.postId == null || r.userId === postOwner.get(r.postId)) return;
    if (!engagers.has(r.postId)) engagers.set(r.postId, new Set());
    engagers.get(r.postId).add(r.userId);
  });
  const summarizePosts = (label, list) => {
    const anyone = list.filter((p) => engagers.get(p.id)?.size).length;
    const realOnes = list.filter((p) => [...(engagers.get(p.id) || [])].some(isReal)).length;
    console.log(`  ${pad(label, 26)} ${lpad(list.length, 4)} posts | engaged by anyone: ${lpad(pct(anyone, list.length), 4)} | by a real user: ${lpad(pct(realOnes, list.length), 4)}`);
  };
  console.log("\n───── POSTS: does anyone respond? (likes/comments from someone other than the author) ─────");
  summarizePosts("Real users' posts", posts.filter((p) => isReal(p.userId)));
  summarizePosts("Your (admin) posts", posts.filter((p) => isAdmin(p.userId)));
  const recent = posts.filter((p) => now - p.createdAt.getTime() < 30 * DAY);
  summarizePosts("All posts, last 30 days", recent);

  // ── 4. Messages ──────────────────────────────────────────────────────────
  const convs = new Map();
  messages.forEach((m) => {
    if (!convs.has(m.conversationId)) convs.set(m.conversationId, []);
    convs.get(m.conversationId).push(m);
  });
  const buckets = { "real → real": [0, 0], "real → you": [0, 0], "you → real": [0, 0] };
  const replyHours = [];
  for (const msgs of convs.values()) {
    const first = msgs[0];
    const a = first.senderId, b = first.receiverId;
    const key = isReal(a) && isReal(b) ? "real → real" : isReal(a) && isAdmin(b) ? "real → you" : isAdmin(a) && isReal(b) ? "you → real" : null;
    if (!key) continue;
    buckets[key][0]++;
    const reply = msgs.find((m) => m.senderId === b);
    if (reply) {
      buckets[key][1]++;
      replyHours.push((reply.createdAt - first.createdAt) / 3600000);
    }
  }
  console.log("\n───── MESSAGES: do threads get a reply? ─────");
  for (const [k, [n, r]] of Object.entries(buckets)) {
    console.log(`  ${pad(k, 14)} ${lpad(n, 4)} threads | replied: ${lpad(r, 3)} (${pct(r, n)})`);
  }
  if (replyHours.length) {
    const s = replyHours.sort((x, y) => x - y);
    console.log(`  Median time to first reply: ${s[Math.floor(s.length / 2)].toFixed(1)} h`);
  }
  const unreadByUser = new Map();
  messages.filter((m) => !m.read && isReal(m.receiverId)).forEach((m) =>
    unreadByUser.set(m.receiverId, (unreadByUser.get(m.receiverId) || 0) + 1));
  const unreadNoPush = [...unreadByUser.keys()].filter((id) => !byId.get(id).pushToken).length;
  console.log(`  Real users with unread messages: ${unreadByUser.size} (${unreadNoPush} have NO push token, so they were never notified)`);

  // ── 5. Every real user ───────────────────────────────────────────────────
  console.log("\n───── REAL USERS, most recent sign of life first ─────");
  console.log("  (push ✗ = can't be notified; seen = last app open once tracking is live)");
  P.sort((a, b) => (b.lastSign?.getTime() || 0) - (a.lastSign?.getTime() || 0)).forEach((p) => {
    const k = Object.entries(p.kinds).map(([kk, v]) => `${kk}:${v}`).join(" ") || (p.u.totalDiagnoses ? `diagnosis:${p.u.totalDiagnoses}` : "nothing");
    console.log(
      `  #${pad(p.u.id, 5)}${pad(p.u.role, 9)}joined ${fmt(p.u.createdAt)}  last ${pad(fmt(p.lastSign), 11)}` +
      `seen ${pad(fmt(p.seen), 11)}push ${p.u.pushToken ? "✓" : "✗"}  ${pad(p.u.name || "—", 18)} ${pad(p.u.email, 30)} ${k}`
    );
  });
  console.log("");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
