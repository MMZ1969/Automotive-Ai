// list-recent-posts.js — READ ONLY. Lists recent posts for quick ID lookup.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      content: true,
      postType: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  console.log("\n=== 20 Most Recent Posts ===\n");
  posts.forEach((p) => {
    const preview = p.content?.slice(0, 60).replace(/\n/g, " ") || "(no content)";
    console.log(`  [${p.id}] ${p.postType} | ${p.user?.name || "?"} (${p.user?.email || "?"}) | ${p.createdAt.toISOString()}`);
    console.log(`        "${preview}${p.content?.length > 60 ? "..." : ""}"\n`);
  });

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});