// check-push-tokens.js — READ ONLY, makes no changes to the database
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.user.count();
  const withToken = await prisma.user.count({
    where: { pushToken: { not: null } },
  });

  console.log("\n-------- PUSH TOKEN CHECK --------");
  console.log(`Total users:          ${total}`);
  console.log(`With a push token:    ${withToken}`);
  console.log(`Missing a push token: ${total - withToken}`);
  console.log("---------------------------------\n");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, emailVerified: true, pushToken: true, createdAt: true },
  });

  console.log("id | created          | verified | token | email");
  for (const u of users) {
    const created = u.createdAt.toISOString().slice(0, 16).replace("T", " ");
    const verified = u.emailVerified ? "Y" : "N";
    const token = u.pushToken ? "YES" : "no";
    console.log(`${u.id} | ${created} | ${verified}        | ${token}   | ${u.email}`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());