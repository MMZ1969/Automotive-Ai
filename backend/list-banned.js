// list-banned.js — READ ONLY. Banned accounts plus the signup ban list.
// Usage: node list-banned.js
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

async function main() {
  const users = await prisma.user.findMany({
    where: { isBanned: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, email: true, role: true, emailVerified: true, createdAt: true, lastSeenAt: true,
      _count: { select: { posts: true, comments: true, messagesSent: true, reports: true } },
    },
  });

  console.log(`${users.length} banned account(s)\n`);
  for (const u of users) {
    console.log(
      `#${String(u.id).padEnd(5)} ${(u.name || "").padEnd(20).slice(0, 20)} ${u.email.padEnd(36)} ` +
        `${u.role.padEnd(8)} joined ${fmt(u.createdAt)}  last seen ${fmt(u.lastSeenAt)}  ` +
        `${u.emailVerified ? "verified" : "unverified"}  posts ${u._count.posts} · comments ${u._count.comments} · ` +
        `msgs ${u._count.messagesSent} · reports filed ${u._count.reports}`
    );
  }

  const bannedEmails = await prisma.bannedEmail.findMany({ select: { email: true } });
  const accountEmails = new Set(users.map((u) => u.email.toLowerCase()));
  const orphaned = bannedEmails.filter((b) => !accountEmails.has(b.email.toLowerCase()));
  console.log(`\n${bannedEmails.length} address(es) on the signup ban list (${orphaned.length} with no banned account, e.g. deleted bots):`);
  for (const b of orphaned) console.log(`   ${b.email}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
