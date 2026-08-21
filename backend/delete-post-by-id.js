// delete-post-by-id.js — deletes a specific post immediately, bypassing
// the in-app report flow. Use for urgent content removal.
//
// Usage: node delete-post-by-id.js <postId>
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const postId = Number(process.argv[2]);
  if (!postId) {
    console.error("Usage: node delete-post-by-id.js <postId>");
    process.exit(1);
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!post) {
    console.error(`No post found with id ${postId}.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`Deleting post [${postId}] by ${post.user?.name} (${post.user?.email})...`);
  console.log(`Content: "${post.content?.slice(0, 100)}"`);

  await prisma.like.deleteMany({ where: { postId } });
  await prisma.comment.deleteMany({ where: { postId } });
  await prisma.report.deleteMany({ where: { postId } });
  await prisma.post.delete({ where: { id: postId } });

  console.log("Deleted.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});