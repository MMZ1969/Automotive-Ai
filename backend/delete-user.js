// delete-user.js
// Fully deletes one or more users and all their related data, in the
// correct dependency order, wrapped in a transaction (all-or-nothing).
// Mirrors the same cleanup order used in auth.controller.js's
// deleteAccount, extended to cover everything in the current schema.
//
// Usage:
//   node delete-user.js 12 48 89

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function deleteUser(userId) {
  await prisma.$transaction(async (tx) => {
    await tx.carShowAttendee.deleteMany({ where: { userId } });
    await tx.carShow.deleteMany({ where: { userId } });
    await tx.message.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } });
    await tx.conversation.deleteMany({ where: { OR: [{ user1Id: userId }, { user2Id: userId }] } });
    await tx.part.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { OR: [{ recipientId: userId }, { actorId: userId }] } });
    await tx.report.deleteMany({ where: { reporterId: userId } });
    await tx.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
    await tx.like.deleteMany({ where: { userId } });
    await tx.comment.deleteMany({ where: { userId } });
    await tx.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } });
    await tx.bid.deleteMany({ where: { OR: [{ mechanicId: userId }, { job: { userId } }] } });
    await tx.review.deleteMany({ where: { OR: [{ reviewerId: userId }, { mechanicId: userId }] } });
    await tx.log.deleteMany({ where: { userId } });
    await tx.vehicle.deleteMany({ where: { userId } });
    await tx.post.deleteMany({ where: { userId } });
    await tx.job.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });
}

async function main() {
  const ids = process.argv.slice(2).map(Number).filter((n) => !isNaN(n));

  if (ids.length === 0) {
    console.log("Usage: node delete-user.js <userId> [userId2] [userId3] ...");
    process.exit(1);
  }

  for (const id of ids) {
    try {
      const user = await prisma.user.findUnique({ where: { id }, select: { email: true } });
      if (!user) {
        console.log(`[${id}] No user found — skipping.`);
        continue;
      }
      await deleteUser(id);
      console.log(`[${id}] Deleted ${user.email}`);
    } catch (err) {
      console.error(`[${id}] FAILED:`, err.message);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("SCRIPT ERROR:", err);
  await prisma.$disconnect();
  process.exit(1);
});