import "dotenv/config";
import prisma from "./src/lib/prisma.js";

async function main() {
  const users = await prisma.user.findMany({
    select: {
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      isVerified: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const verified = users.filter((u) => u.emailVerified);
  const unverified = users.filter((u) => !u.emailVerified);

  console.log(`\n✅ EMAIL-VERIFIED (${verified.length}):`);
  verified.forEach((u) => {
    const mech = u.isVerified ? "  🔧 verified-mechanic" : "";
    console.log(`  • ${u.name}  <${u.email}>  [${u.role}]${mech}`);
  });

  console.log(`\n❌ NOT VERIFIED (${unverified.length}):`);
  unverified.forEach((u) => {
    const days = Math.floor((Date.now() - new Date(u.createdAt)) / 86400000);
    console.log(`  • ${u.name}  <${u.email}>  [${u.role}]  (${days}d old)`);
  });

  console.log(`\n— ${users.length} total | ${verified.length} verified | ${unverified.length} unverified —\n`);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());