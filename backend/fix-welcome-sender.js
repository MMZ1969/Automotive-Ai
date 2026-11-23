// fix-welcome-sender.js — one-off. Moves the 11/22 welcome DMs (logged in
// reports/welcome-dms-sent.json) from account #100 to Michael's real account
// #1. Nothing is re-sent and no push goes out; recipients' threads just show
// the message as coming from #1, and replies will reach #1.
//
//   node fix-welcome-sender.js          DRY RUN — shows what would move
//   node fix-welcome-sender.js --apply  does it
import "dotenv/config";
import { readFileSync } from "fs";
import prisma from "./src/lib/prisma.js";

const OLD = 100;
const NEW = 1;
const apply = process.argv.includes("--apply");

try {
  const sent = JSON.parse(readFileSync("reports/welcome-dms-sent.json", "utf8"));
  const [oldU, newU] = await Promise.all([
    prisma.user.findUnique({ where: { id: OLD }, select: { name: true, email: true } }),
    prisma.user.findUnique({ where: { id: NEW }, select: { name: true, email: true } }),
  ]);
  console.log(`${apply ? "APPLYING" : "DRY RUN (add --apply)"} — moving from #${OLD} ${oldU?.name} <${oldU?.email}> to #${NEW} ${newU?.name} <${newU?.email}>\n`);

  for (const { messageId, userId, name } of sent) {
    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) { console.log(`✗ #${userId} ${name}: message ${messageId} not found`); continue; }
    if (msg.senderId !== OLD) { console.log(`– #${userId} ${name}: message ${messageId} already from #${msg.senderId}, skipped`); continue; }

    console.log(`→ #${userId} ${name}: message ${messageId}`);
    if (!apply) continue;

    const user1Id = Math.min(NEW, userId), user2Id = Math.max(NEW, userId);
    const convo = await prisma.conversation.upsert({
      where: { user1Id_user2Id: { user1Id, user2Id } },
      update: { updatedAt: new Date() },
      create: { user1Id, user2Id },
    });
    await prisma.message.update({
      where: { id: messageId },
      data: { senderId: NEW, conversationId: convo.id },
    });
    const left = await prisma.message.count({ where: { conversationId: msg.conversationId } });
    if (left === 0) await prisma.conversation.delete({ where: { id: msg.conversationId } });
    console.log(`  ✓ moved to conversation ${convo.id}${left === 0 ? `, removed empty conversation ${msg.conversationId}` : ""}`);
  }
} catch (err) {
  console.error("ERROR:", err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
