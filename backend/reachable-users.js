// reachable-users.js — READ ONLY. Real users who have a push token, with enough
// context to write each one a personal message.
//
// Per user: role, joined, last seen, vehicles, diagnoses (count + recent
// questions), posts, and any thread with an admin (who started it, whether
// they replied, unread count).
//
// Usage:  node reachable-users.js
// Also writes reports/reachable-users.txt
import "dotenv/config";
import fs from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TEST_EMAILS = ["test@google.com", "apple@test.com"];
const DAY = 24 * 60 * 60 * 1000;
const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");
const ago = (d) => {
  if (!d) return "never";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / DAY);
  return days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
};
const clip = (s, n = 90) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");

async function main() {
  const admins = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  const adminIds = new Set(admins.map((a) => a.id));

  const users = await prisma.user.findMany({
    where: {
      pushToken: { not: null },
      isAdmin: false,
      isBanned: false,
      email: { notIn: TEST_EMAILS },
    },
    orderBy: { lastSeenAt: { sort: "desc", nulls: "last" } },
    select: {
      id: true, name: true, email: true, role: true, location: true, isVerified: true,
      createdAt: true, lastSeenAt: true, totalDiagnoses: true, lastDiagnosisDate: true,
      vehicles: { select: { year: true, make: true, model: true, trim: true } },
      diagnosisLogs: { orderBy: { createdAt: "desc" }, take: 3, select: { query: true, vehicleLabel: true, createdAt: true } },
      _count: { select: { posts: true, comments: true, logs: true, parts: true, followers: true } },
    },
  });

  const out = [];
  const say = (s = "") => { out.push(s); console.log(s); };
  say(`REACHABLE USERS (have a push token): ${users.length} — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`);
  say("Push token can be stale (app deleted / notifications off). Nothing here proves delivery.");

  for (const u of users) {
    const msgs = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: u.id, receiverId: { in: [...adminIds] } },
          { receiverId: u.id, senderId: { in: [...adminIds] } },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: { senderId: true, read: true, content: true, createdAt: true },
    });

    say("");
    say(`#${u.id}  ${u.name || "—"}  (${u.role}${u.isVerified ? ", verified" : ""})  ${u.email}`);
    say(`  joined ${fmt(u.createdAt)} | last seen ${ago(u.lastSeenAt)}${u.location ? ` | ${u.location}` : ""}`);
    say(`  vehicles: ${u.vehicles.length ? u.vehicles.map((v) => `${v.year} ${v.make} ${v.model}${v.trim ? " " + v.trim : ""}`).join("; ") : "none"}`);
    say(`  diagnoses: ${u.totalDiagnoses} (last ${fmt(u.lastDiagnosisDate)}) | posts ${u._count.posts}, comments ${u._count.comments}, logs ${u._count.logs}, parts ${u._count.parts}, followers ${u._count.followers}`);
    for (const d of u.diagnosisLogs) {
      say(`    · ${fmt(d.createdAt)} ${d.vehicleLabel ? `[${d.vehicleLabel}] ` : ""}"${clip(d.query)}"`);
    }
    if (msgs.length) {
      const youStarted = adminIds.has(msgs[0].senderId);
      const theirs = msgs.filter((m) => m.senderId === u.id).length;
      const unread = msgs.filter((m) => m.senderId !== u.id && !m.read).length;
      say(`  thread with you: ${msgs.length} msgs, ${youStarted ? "you started" : "they started"}, ${theirs} from them, ${unread} of yours unread`);
      const last = msgs[msgs.length - 1];
      say(`    last (${fmt(last.createdAt)}, ${last.senderId === u.id ? "them" : "you"}): "${clip(last.content)}"`);
    } else {
      say("  thread with you: none");
    }
  }

  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync("reports/reachable-users.txt", out.join("\n") + "\n");
  console.log("\nSaved reports/reachable-users.txt");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
