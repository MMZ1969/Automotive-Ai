// inspect-users.js — READ ONLY. Counts real activity per user. No writes, no deletes.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      _count: {
        select: {
          posts: true,
          comments: true,
          likes: true,
          messagesSent: true,
          jobsPosted: true,
          bids: true,
          vehicles: true,
          following: true,
        },
      },
    },
  });

  const scored = users.map((u) => {
    const c = u._count;
    // "Real activity" = things a human actively DOES (not passive signup state)
    const activity =
      c.posts + c.comments + c.likes + c.messagesSent +
      c.jobsPosted + c.bids + c.vehicles + c.following;
    return { ...u, activity, c };
  });

  const active = scored.filter((u) => u.activity > 0);
  const dead = scored.filter((u) => u.activity === 0);

  // Rough junk heuristic: dead AND email looks fake/malformed
  const looksJunk = (email) =>
    !email.includes("@") ||
    email.includes("example.com") ||
    email.includes("test@") ||
    email.endsWith("@google.com");

  const deadJunk = dead.filter((u) => looksJunk(u.email));
  const deadReal = dead.filter((u) => !looksJunk(u.email));

  console.log("\n══════════ USER ACTIVITY AUDIT ══════════");
  console.log(`Total users:        ${scored.length}`);
  console.log(`ACTIVE (did something): ${active.length}`);
  console.log(`DEAD - real email:      ${deadReal.length}  ← re-activation targets`);
  console.log(`DEAD - junk/test email: ${deadJunk.length}  ← likely noise`);
  console.log("═════════════════════════════════════════\n");

  const line = (u) =>
    `#${u.id} | ${u.emailVerified ? "✓" : "✗"} | act:${u.activity} ` +
    `(p${u.c.posts} c${u.c.comments} l${u.c.likes} m${u.c.messagesSent} j${u.c.jobsPosted} b${u.c.bids} v${u.c.vehicles} f${u.c.following}) ` +
    `| ${u.role} | ${u.email}`;

  console.log("───── ACTIVE USERS (your real humans) ─────");
  active.sort((a, b) => b.activity - a.activity).forEach((u) => console.log(line(u)));

  console.log("\n───── DEAD but REAL email (bounced — talk to these) ─────");
  deadReal.forEach((u) => console.log(line(u)));

  console.log("\n───── DEAD + junk/test email (probably ignore) ─────");
  deadJunk.forEach((u) => console.log(line(u)));
  console.log("");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());