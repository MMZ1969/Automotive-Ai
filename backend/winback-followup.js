// winback-followup.js: second and LAST email to win-back recipients who show
// no sign of life since the first one (no activity, never seen logged in).
//
// Why a follow-up at all: until 10/19, logins expired after 7 days, so anyone
// who opened the app after the first email was likely logged out and left no
// trace (Brian told us exactly this). Logins now last 90 days, so this email
// says so plainly and asks them to sign in once.
//
// Same safety model as winback-email.js:
//   node winback-followup.js                   DRY RUN: lists recipients + prints every email
//   node winback-followup.js --test            sends ONE sample to TEST_TO
//   node winback-followup.js --confirm         sends for real, ~2/sec
//   node winback-followup.js --confirm --limit 5
//
// Sends are logged to reports/winback-followup-sent.json and never repeated.
// reports/winback-optout.txt is honored. --confirm requires WINBACK_POSTAL_ADDRESS.
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

// People who replied to the first email and got a personal answer. A form
// email on top of that would read as a bot. Add anyone else who replies.
const EXCLUDE_EMAILS = ["hewasnumber1@live.com", "dtours01@hotmail.com"];

const REPORTS = path.join(process.cwd(), "reports");
const FIRST_SENT_FILE = path.join(REPORTS, "winback-sent.json");
const SENT_FILE = path.join(REPORTS, "winback-followup-sent.json");
const OPTOUT_FILE = path.join(REPORTS, "winback-optout.txt");
const MIN_DAYS_SINCE_FIRST = 5;

const DAY = 24 * 60 * 60 * 1000;
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
  const first = readJson(FIRST_SENT_FILE, {});
  const entries = Object.entries(first).map(([email, v]) => ({ email, userId: v.userId, firstAt: new Date(v.at) }));
  const users = await prisma.user.findMany({
    where: { id: { in: entries.map((e) => e.userId).filter(Boolean) } },
    select: {
      id: true, email: true, name: true, isBanned: true, lastSeenAt: true, lastDiagnosisDate: true,
      vehicles: { orderBy: { createdAt: "desc" }, take: 1, select: { year: true, make: true, model: true, createdAt: true } },
      posts: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      comments: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      likes: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      messagesSent: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      logs: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      following: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const sent = new Set(Object.keys(readJson(SENT_FILE, {})).map((e) => e.toLowerCase()));
  const optout = new Set(readLines(OPTOUT_FILE));
  const exclude = new Set(EXCLUDE_EMAILS.map((e) => e.toLowerCase()));
  const now = Date.now();

  return entries
    .map((e) => ({ ...e, u: byId.get(e.userId) }))
    .filter((e) => e.u && !e.u.isBanned)
    .filter((e) => now - e.firstAt.getTime() >= MIN_DAYS_SINCE_FIRST * DAY)
    .filter(({ u, firstAt }) => {
      const signs = [
        u.lastSeenAt, u.lastDiagnosisDate,
        ...[u.vehicles, u.posts, u.comments, u.likes, u.messagesSent, u.logs, u.following].map((l) => l[0]?.createdAt),
      ].filter(Boolean);
      return !signs.some((d) => new Date(d) > firstAt); // "no sign" since the first email
    })
    .filter(({ u }) => {
      const em = u.email.toLowerCase();
      return !sent.has(em) && !optout.has(em) && !exclude.has(em);
    });
}

function compose(u) {
  const firstName = (u.name || "").trim().split(/\s+/)[0];
  const hello = firstName && /^[\p{L}'-]{2,20}$/u.test(firstName)
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : "there";
  const v = u.vehicles[0];
  // "nissan altima" -> "Nissan Altima"; VIN-decoded "CHEVROLET"/"VOLVO" -> "Chevrolet"/"Volvo".
  // Short all-caps words (BMW, GMC, SLE, BW) and mixed case (M440i, XC90) stay as typed.
  const tidy = (s) => s.replace(/\s+/g, " ").trim().split(" ").map((w) => {
    if (/^[a-z]+$/.test(w)) return w[0].toUpperCase() + w.slice(1);
    if (/^[A-Z]{4,}$/.test(w)) return w[0] + w.slice(1).toLowerCase();
    return w;
  }).join(" ");
  const vehicle = v ? tidy(`${v.year} ${v.make} ${v.model}`) : null;

  const subject = "Sorry, AutoAI was logging people out";
  const paras = [
    `Michael from AutoAI again. This is the last email from me, promise.`,
    `After my note last week, someone told me they opened the app and found themselves logged out. That was a bug on my end: logins were expiring after 7 days. It's fixed. Sign in once and it keeps you signed in.`,
    `Your account${vehicle ? `, your ${vehicle},` : ""} and everything you saved are still there. If you don't remember your password, tap "Forgot password" on the login screen and it'll email you a reset link.`,
    `And if something else got in the way, just reply and tell me. It's only me building this, and I read every one.`,
  ];

  const text = [
    `Hey ${hello},`, "",
    ...paras.flatMap((p) => [p, ""]),
    `iPhone: ${IOS_URL}`,
    `Android: ${ANDROID_URL}`, "",
    "Michael", "",
    "--",
    "You're getting this because you have an AutoAI account. Reply \"stop\" and I won't email you again.",
    POSTAL_ADDRESS || "[POSTAL ADDRESS MISSING]",
  ].join("\n");

  const btn = (href, label) =>
    `<a href="${href}" style="display:inline-block;background:#345bff;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:10px;margin:4px 8px 4px 0;">${label}</a>`;
  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#111827;font-size:15px;line-height:1.6;">
  <p>Hey ${esc(hello)},</p>
  ${paras.map((p) => `<p>${esc(p)}</p>`).join("\n  ")}
  <p>${btn(IOS_URL, "Open on iPhone")}${btn(ANDROID_URL, "Open on Android")}</p>
  <p>Michael</p>
  <p style="color:#6b7280;font-size:12px;margin-top:28px;border-top:1px solid #e5e7eb;padding-top:12px;">
    You're getting this because you have an AutoAI account. Reply "stop" and I won't email you again.<br>
    ${esc(POSTAL_ADDRESS || "[POSTAL ADDRESS MISSING]")}
  </p>
</div>`;
  return { subject, text, html };
}

async function main() {
  fs.mkdirSync(REPORTS, { recursive: true });
  const recipients = (await findRecipients()).slice(0, LIMIT);
  console.log(`\n=== Win-back FOLLOW-UP: ${MODE.toUpperCase()} ===`);
  console.log(`${recipients.length} recipient(s): got the first email ${MIN_DAYS_SINCE_FIRST}+ days ago, no sign since, not excluded\n`);
  recipients.forEach(({ u, firstAt }) =>
    console.log(`  #${u.id}  ${u.email}  ${u.vehicles[0] ? `${u.vehicles[0].year} ${u.vehicles[0].make} ${u.vehicles[0].model}` : "(no vehicle)"}  first: ${firstAt.toISOString().slice(0, 10)}`));
  if (!POSTAL_ADDRESS) console.log("\nWARNING: WINBACK_POSTAL_ADDRESS is not set in .env. --confirm will refuse to send.");

  if (MODE === "dry") {
    for (const { u } of recipients) {
      const m = compose(u);
      console.log(`\n────────── to ${u.email} ──────────\nSubject: ${m.subject}\n\n${m.text}`);
    }
    console.log(`\nDry run: nothing sent. Next: node winback-followup.js --test (sends one sample to ${TEST_TO})\n`);
    return;
  }

  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY missing from .env");
  const resend = new Resend(process.env.RESEND_API_KEY);

  if (MODE === "test") {
    if (!recipients.length) return console.log("No recipients to sample.");
    const { u } = recipients[0];
    const m = compose(u);
    const { error } = await resend.emails.send({
      from: FROM, to: TEST_TO, replyTo: REPLY_TO,
      subject: `[TEST for ${u.email}] ${m.subject}`, text: m.text, html: m.html,
    });
    if (error) throw new Error(error.message);
    console.log(`\nSample sent to ${TEST_TO}. If it looks right: node winback-followup.js --confirm\n`);
    return;
  }

  if (!POSTAL_ADDRESS) {
    throw new Error("WINBACK_POSTAL_ADDRESS missing from .env (CAN-SPAM requires a postal address). Nothing sent.");
  }

  const log = readJson(SENT_FILE, {});
  let ok = 0, failed = 0;
  for (const { u } of recipients) {
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
  console.log(`\nDone: ${ok} sent, ${failed} failed. Log: reports/winback-followup-sent.json\n`);
}

main()
  .catch((e) => { console.error("WINBACK FOLLOW-UP ERROR:", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
