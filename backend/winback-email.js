// winback-email.js: one-time personal check-in email from Michael to users
// who DID something (added a vehicle, ran a diagnosis, posted...) and then went quiet.
// (nudge-inactive-users.js covers the people who never did anything.)
//
// Safe by default:
//   node winback-email.js                    DRY RUN: lists recipients + prints every email
//   node winback-email.js --test             sends ONE sample (first recipient's version) to TEST_TO
//   node winback-email.js --confirm          sends for real, ~2/sec
//   node winback-email.js --confirm --limit 5   send to the first 5 only
//
// Every successful send is recorded in reports/winback-sent.json, and anyone in
// that file is skipped forever, so re-running never double-emails anyone.
// Replies go to REPLY_TO. If someone replies "stop", add their email to
// reports/winback-optout.txt (one per line) and they'll be skipped too.
//
// CAN-SPAM: every email must show a valid postal address (a PO box or a
// registered virtual mailbox is fine). Set it in backend/.env, e.g.
//   WINBACK_POSTAL_ADDRESS="AutoAI, PO Box 123, Galloway, NJ 08205"
// --confirm refuses to run without it.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import fs from "fs";
import path from "path";

const FROM = "Michael at AutoAI <noreply@send.amazmade.com>";
const REPLY_TO = "maz@amazmade.com";
const TEST_TO = "maz@amazmade.com";
const IOS_URL = "https://apps.apple.com/us/app/autoai-auto-intelligence/id6764058138";
const ANDROID_URL = "https://play.google.com/store/apps/details?id=app.automotiveai";
const POSTAL_ADDRESS = (process.env.WINBACK_POSTAL_ADDRESS || "").trim();

const TEST_EMAILS = ["test@google.com", "apple@test.com"];
const EXCLUDE_IDS = [6, 100]; // Lauren, Michael's amazmade account
const QUIET_DAYS = 14; // only users with no sign of life for this long

const REPORTS = path.join(process.cwd(), "reports");
const SENT_FILE = path.join(REPORTS, "winback-sent.json");
const OPTOUT_FILE = path.join(REPORTS, "winback-optout.txt");

const DAY = 24 * 60 * 60 * 1000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const MODE = args.includes("--confirm") ? "send" : args.includes("--test") ? "test" : "dry";
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function readLines(file) {
  try {
    return fs.readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter(Boolean);
  } catch { return []; }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findRecipients() {
  const users = await prisma.user.findMany({
    where: {
      isAdmin: false,
      isBanned: false,
      emailVerified: true,
      email: { notIn: TEST_EMAILS },
      id: { notIn: EXCLUDE_IDS },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, email: true, name: true, role: true, createdAt: true,
      totalDiagnoses: true, lastDiagnosisDate: true,
      vehicles: { orderBy: { createdAt: "desc" }, take: 1, select: { year: true, make: true, model: true, createdAt: true } },
      posts: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      comments: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      likes: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      messagesSent: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      logs: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      following: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  // lastSeenAt exists from 2026-10-15; read separately so the script still runs without it
  const seen = new Map();
  try {
    (await prisma.user.findMany({ select: { id: true, lastSeenAt: true } }))
      .forEach((r) => seen.set(r.id, r.lastSeenAt));
  } catch { /* column not present */ }

  const sent = new Set(Object.keys(readJson(SENT_FILE, {})).map((e) => e.toLowerCase()));
  const optout = new Set(readLines(OPTOUT_FILE));
  const now = Date.now();

  return users
    .map((u) => {
      const dates = [
        u.lastDiagnosisDate, seen.get(u.id),
        ...[u.vehicles, u.posts, u.comments, u.likes, u.messagesSent, u.logs, u.following]
          .map((list) => list[0]?.createdAt),
      ].filter(Boolean).map((d) => new Date(d));
      const activated = dates.length > 0 || u.totalDiagnoses > 0;
      const lastSign = dates.length ? new Date(Math.max(...dates)) : null;
      return { ...u, activated, lastSign };
    })
    .filter((u) => u.activated)
    .filter((u) => !u.lastSign || now - u.lastSign.getTime() > QUIET_DAYS * DAY)
    .filter((u) => !sent.has(u.email.toLowerCase()) && !optout.has(u.email.toLowerCase()));
}

function compose(u) {
  const first = (u.name || "").trim().split(/\s+/)[0];
  const hello = first && /^[\p{L}'-]{2,20}$/u.test(first)
    ? first.charAt(0).toUpperCase() + first.slice(1) : "there";
  const v = u.vehicles[0];
  const vehicle = v ? `${v.year} ${v.make} ${v.model}`.replace(/\s+/g, " ").trim() : null;
  const month = MONTHS[new Date(u.createdAt).getMonth()];
  const ranDiag = u.totalDiagnoses > 0;
  const isMechanic = u.role === "MECHANIC";

  const subject = vehicle ? `How's the ${vehicle} doing?` : "Quick check-in from AutoAI";

  let opener;
  if (vehicle && ranDiag) opener = `You signed up for AutoAI back in ${month}, added your ${vehicle}, and ran a diagnosis on it. I wanted to check in: did you get it sorted?`;
  else if (vehicle) opener = `You signed up for AutoAI back in ${month} and added your ${vehicle}. I wanted to check in and see how it's running.`;
  else if (ranDiag) opener = `You signed up for AutoAI back in ${month} and ran a diagnosis. I wanted to check in: did you get it sorted?`;
  else opener = `You signed up for AutoAI back in ${month}, and I wanted to check in.`;

  const bullets = [
    "Notifications now work on Android, so you'll actually hear back when someone replies to you.",
    "Diagnoses give step-by-step procedures for your exact vehicle, down to the brackets and connectors.",
    isMechanic
      ? "DIYers near you post jobs and questions. Verified mechanics show up on the Near Me map."
      : "You get 8 free diagnoses a day, and real mechanics on the app can weigh in on your posts.",
  ];

  const text = [
    `Hey ${hello},`,
    "",
    `It's Michael, the guy who built AutoAI. ${opener}`,
    "",
    "A few things have changed since you last opened it:",
    ...bullets.map((b) => `- ${b}`),
    "",
    "If something didn't work or wasn't useful, just hit reply and tell me. I read every one, and it's just me building this.",
    "",
    `iPhone: ${IOS_URL}`,
    `Android: ${ANDROID_URL}`,
    "",
    "Michael",
    "",
    "--",
    "You're getting this one-time email because you have an AutoAI account. Reply \"stop\" and I won't email you again.",
    POSTAL_ADDRESS || "[POSTAL ADDRESS MISSING]",
  ].join("\n");

  const btn = (href, label) =>
    `<a href="${href}" style="display:inline-block;background:#345bff;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:10px;margin:4px 8px 4px 0;">${label}</a>`;
  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#111827;font-size:15px;line-height:1.6;">
  <p>Hey ${esc(hello)},</p>
  <p>It's Michael, the guy who built AutoAI. ${esc(opener)}</p>
  <p>A few things have changed since you last opened it:</p>
  <ul style="padding-left:20px;">${bullets.map((b) => `<li style="margin-bottom:6px;">${esc(b)}</li>`).join("")}</ul>
  <p>If something didn't work or wasn't useful, just hit reply and tell me. I read every one, and it's just me building this.</p>
  <p>${btn(IOS_URL, "Open on iPhone")}${btn(ANDROID_URL, "Open on Android")}</p>
  <p>Michael</p>
  <p style="color:#6b7280;font-size:12px;margin-top:28px;border-top:1px solid #e5e7eb;padding-top:12px;">
    You're getting this one-time email because you have an AutoAI account. Reply "stop" and I won't email you again.<br>
    ${esc(POSTAL_ADDRESS || "[POSTAL ADDRESS MISSING]")}
  </p>
</div>`;
  return { subject, text, html };
}

async function main() {
  fs.mkdirSync(REPORTS, { recursive: true });
  const recipients = (await findRecipients()).slice(0, LIMIT);
  console.log(`\n=== Win-back email: ${MODE.toUpperCase()} ===`);
  console.log(`${recipients.length} recipient(s): activated, verified, quiet ${QUIET_DAYS}+ days, not emailed before\n`);
  recipients.forEach((u) =>
    console.log(`  #${u.id}  ${u.email}  ${u.vehicles[0] ? `${u.vehicles[0].year} ${u.vehicles[0].make} ${u.vehicles[0].model}` : "(no vehicle)"}  last: ${u.lastSign ? u.lastSign.toISOString().slice(0, 10) : "-"}`));

  if (!POSTAL_ADDRESS) {
    console.log("WARNING: WINBACK_POSTAL_ADDRESS is not set in .env. --confirm will refuse to send.\n");
  }

  if (MODE === "dry") {
    for (const u of recipients) {
      const m = compose(u);
      console.log(`\n────────── to ${u.email} ──────────\nSubject: ${m.subject}\n\n${m.text}`);
    }
    console.log(`\nDry run: nothing sent. Next: node winback-email.js --test (sends one sample to ${TEST_TO})\n`);
    return;
  }

  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY missing from .env");
  const resend = new Resend(process.env.RESEND_API_KEY);

  if (MODE === "test") {
    if (!recipients.length) return console.log("No recipients to sample.");
    const m = compose(recipients[0]);
    const { error } = await resend.emails.send({
      from: FROM, to: TEST_TO, replyTo: REPLY_TO,
      subject: `[TEST for ${recipients[0].email}] ${m.subject}`, text: m.text, html: m.html,
    });
    if (error) throw new Error(error.message);
    console.log(`\nSample sent to ${TEST_TO}. If it looks right: node winback-email.js --confirm\n`);
    return;
  }

  if (!POSTAL_ADDRESS) {
    throw new Error("WINBACK_POSTAL_ADDRESS missing from .env (CAN-SPAM requires a postal address). Nothing sent.");
  }

  const log = readJson(SENT_FILE, {});
  let ok = 0, failed = 0;
  for (const u of recipients) {
    const m = compose(u);
    try {
      const { data, error } = await resend.emails.send({
        from: FROM, to: u.email, replyTo: REPLY_TO, subject: m.subject, text: m.text, html: m.html,
      });
      if (error) throw new Error(error.message);
      log[u.email] = { userId: u.id, at: new Date().toISOString(), resendId: data?.id || null };
      fs.writeFileSync(SENT_FILE, JSON.stringify(log, null, 2)); // after each send, so a crash never double-sends
      console.log(`  sent  ${u.email}`);
      ok++;
    } catch (err) {
      console.error(`  FAIL  ${u.email}: ${err.message}`);
      failed++;
    }
    await sleep(600); // stay under Resend's 2 requests/second
  }
  console.log(`\nDone: ${ok} sent, ${failed} failed. Log: reports/winback-sent.json\n`);
}

main()
  .catch((e) => { console.error("WINBACK ERROR:", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
