// send-welcome-dms.js — sends personal welcome DMs from Michael's account,
// exactly like sending them in the app (conversation + message + push).
//
// Three steps:
//   1. node send-welcome-dms.js preview 289 285 280
//        READ ONLY. Shows each user's role, location, vehicles, recent
//        diagnosis questions, and any earlier messages with you.
//        Output: console + reports/welcome-preview.txt
//   2. node send-welcome-dms.js
//        DRY RUN. Reads welcome-dms.json and shows exactly who gets what.
//        Nothing is sent.
//   3. node send-welcome-dms.js --send
//        Sends. Skips anyone banned, blocked, or already DM'd by you in the
//        last 7 days (so a re-run can't double-send).
//        Log: reports/welcome-dms-sent.json
//
// welcome-dms.json (backend root):  [ { "userId": 289, "text": "Hey ..." }, ... ]
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import prisma from "./src/lib/prisma.js";
import { sendPushNotification } from "./src/controllers/notification.controller.js";

const SENDER_ID = 1; // Michael (maz@amazmade.com)
const DAY = 24 * 60 * 60 * 1000;
const args = process.argv.slice(2);
const mode = args[0] === "preview" ? "preview" : args.includes("--send") ? "send" : "dry";

const out = [];
const log = (s = "") => { console.log(s); out.push(s); };
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
mkdirSync("reports", { recursive: true });

async function conversationWith(userId) {
  const user1Id = Math.min(SENDER_ID, userId);
  const user2Id = Math.max(SENDER_ID, userId);
  return prisma.conversation.findUnique({
    where: { user1Id_user2Id: { user1Id, user2Id } },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
}

async function preview(ids) {
  log(`══════ WELCOME DM PREVIEW — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC ══════`);
  for (const id of ids) {
    const u = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, role: true, location: true, createdAt: true, lastSeenAt: true, pushToken: true, isBanned: true },
    });
    if (!u) { log(`\n#${id}  NOT FOUND`); continue; }
    const vehicles = await prisma.vehicle.findMany({
      where: { userId: id },
      select: { year: true, make: true, model: true, trim: true, mileage: true },
    });
    const diags = await prisma.diagnosisLog.findMany({
      where: { userId: id }, orderBy: { createdAt: "desc" }, take: 3,
      select: { query: true, vehicleLabel: true },
    });
    const posts = await prisma.post.findMany({
      where: { userId: id }, orderBy: { createdAt: "desc" }, take: 2,
    }).catch(() => []);
    const convo = await conversationWith(id);

    log(`\n#${u.id}  ${u.name || "(no name)"}  ${u.role}  joined ${day(u.createdAt)}  last seen ${day(u.lastSeenAt)}  push ${u.pushToken ? "✓" : "✗"}${u.isBanned ? "  BANNED" : ""}`);
    log(`   location: ${u.location || "—"}`);
    log(`   vehicles: ${vehicles.length ? vehicles.map((v) => `${v.year} ${v.make} ${v.model}${v.trim ? " " + v.trim : ""}${v.mileage ? ` (${v.mileage} mi)` : ""}`).join("; ") : "none"}`);
    for (const d of diags) log(`   asked: "${String(d.query).slice(0, 110)}"${d.vehicleLabel ? `  [${d.vehicleLabel}]` : ""}`);
    for (const p of posts) log(`   posted: "${String(p.content || p.title || "").slice(0, 110)}"`);
    if (convo?.messages.length) {
      for (const m of [...convo.messages].reverse()) {
        log(`   msg ${m.senderId === SENDER_ID ? "you →" : "→ you"} ${day(m.createdAt)}: "${String(m.content).slice(0, 90)}"`);
      }
    } else {
      log(`   no messages with you yet`);
    }
  }
  const sender = await prisma.user.findUnique({ where: { id: SENDER_ID }, select: { name: true } });
  log(`\nMessages will be sent as #${SENDER_ID} "${sender?.name}".`);
  writeFileSync("reports/welcome-preview.txt", out.join("\n") + "\n");
}

async function sendAll() {
  if (!existsSync("welcome-dms.json")) {
    console.log("welcome-dms.json not found in the backend folder.");
    return;
  }
  const list = JSON.parse(readFileSync("welcome-dms.json", "utf8"));
  const sender = await prisma.user.findUnique({ where: { id: SENDER_ID }, select: { name: true } });
  log(`${mode === "send" ? "SENDING" : "DRY RUN (add --send to send)"} — ${list.length} message(s) from "${sender?.name}"`);
  const results = [];

  for (const { userId, text } of list) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, isBanned: true, pushToken: true } });
    const tag = `#${userId} ${u?.name ?? "?"}`;
    if (!u) { log(`\n✗ ${tag}: user not found — skipped`); continue; }
    if (u.isBanned) { log(`\n✗ ${tag}: banned — skipped`); continue; }
    if (!text || !text.trim()) { log(`\n✗ ${tag}: empty text — skipped`); continue; }
    const block = await prisma.block.findFirst({
      where: { OR: [{ blockerId: SENDER_ID, blockedId: userId }, { blockerId: userId, blockedId: SENDER_ID }] },
    });
    if (block) { log(`\n✗ ${tag}: blocked — skipped`); continue; }
    const convo = await conversationWith(userId);
    const recent = convo?.messages.find((m) => m.senderId === SENDER_ID && Date.now() - new Date(m.createdAt) < 7 * DAY);
    if (recent) { log(`\n✗ ${tag}: you already messaged them ${day(recent.createdAt)} — skipped`); continue; }

    log(`\n→ ${tag}  (push ${u.pushToken ? "✓" : "✗ — they'll see it next time they open the app"})`);
    log(`  "${text}"`);
    if (mode !== "send") continue;

    const c = convo ?? await prisma.conversation.create({
      data: { user1Id: Math.min(SENDER_ID, userId), user2Id: Math.max(SENDER_ID, userId) },
    });
    const message = await prisma.message.create({
      data: { conversationId: c.id, senderId: SENDER_ID, receiverId: userId, content: text },
    });
    await prisma.conversation.update({ where: { id: c.id }, data: { updatedAt: new Date() } });
    if (u.pushToken) {
      const unread = await prisma.message.count({ where: { receiverId: userId, read: false } });
      const body = text.length > 80 ? text.slice(0, 80) + "…" : text;
      await sendPushNotification(u.pushToken, `${sender?.name} 💬`, body, unread);
    }
    results.push({ userId, name: u.name, messageId: message.id, sentAt: new Date().toISOString(), push: !!u.pushToken });
    log(`  ✓ sent (message #${message.id})`);
  }

  if (mode === "send") {
    const path = "reports/welcome-dms-sent.json";
    const prior = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : [];
    writeFileSync(path, JSON.stringify([...prior, ...results], null, 2));
    log(`\nSent ${results.length}. Logged to ${path}. (Push receipts print over the next ~20 s.)`);
  }
}

try {
  if (mode === "preview") {
    const ids = args.slice(1).map(Number).filter(Boolean);
    if (!ids.length) console.log("Usage: node send-welcome-dms.js preview 289 285 ...");
    else await preview(ids);
  } else {
    await sendAll();
  }
} catch (err) {
  console.error("ERROR:", err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
