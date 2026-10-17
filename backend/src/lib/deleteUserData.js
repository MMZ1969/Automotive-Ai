// deleteUserData.js
// Single source of truth for fully deleting a user. Used by the in-app
// "Delete Account" (auth.controller.js deleteAccount) and by the
// backend/delete-user.js admin script.
//
// Removes the user's own rows AND rows other people attached to the user's
// content (comments/likes on their posts, bids/reviews on their jobs,
// attendees of their car shows), which would otherwise block the delete
// via foreign keys. Reports filed by others against the user's posts/jobs
// are kept, with the post/job link nulled, so moderation history survives.
//
// Takes a Prisma client and runs everything in one transaction.

export async function deleteUserData(prisma, userId) {
  return prisma.$transaction(
    async (tx) => {
      const ids = async (model, where) =>
        (await tx[model].findMany({ where, select: { id: true } })).map((r) => r.id);

      const postIds = await ids("post", { userId });
      const jobIds = await ids("job", { userId });
      const showIds = await ids("carShow", { userId });
      const convoIds = await ids("conversation", { OR: [{ user1Id: userId }, { user2Id: userId }] });

      // Comments: the user's own, everything on their posts, plus every reply
      // (at any depth) underneath those, including replies written by others.
      const commentIds = new Set(
        await ids("comment", { OR: [{ userId }, { postId: { in: postIds } }] })
      );
      let frontier = [...commentIds];
      while (frontier.length) {
        const replies = await ids("comment", { parentId: { in: frontier } });
        frontier = replies.filter((id) => !commentIds.has(id));
        frontier.forEach((id) => commentIds.add(id));
      }
      const allCommentIds = [...commentIds];

      // Social
      await tx.like.deleteMany({
        where: { OR: [{ userId }, { postId: { in: postIds } }, { commentId: { in: allCommentIds } }] },
      });
      await tx.comment.deleteMany({ where: { id: { in: allCommentIds } } });
      await tx.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } });
      await tx.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
      await tx.notification.deleteMany({
        where: {
          OR: [
            { recipientId: userId },
            { actorId: userId },
            { postId: { in: postIds } },
            { jobId: { in: jobIds } },
          ],
        },
      });

      // Reports: drop ones this user filed; keep others' reports on this
      // user's content but detach them (targetOwnerId/targetSnapshot remain).
      await tx.report.deleteMany({ where: { reporterId: userId } });
      await tx.report.updateMany({ where: { postId: { in: postIds } }, data: { postId: null } });
      await tx.report.updateMany({ where: { jobId: { in: jobIds } }, data: { jobId: null } });

      // Messaging
      await tx.message.deleteMany({
        where: { OR: [{ conversationId: { in: convoIds } }, { senderId: userId }, { receiverId: userId }] },
      });
      await tx.conversation.deleteMany({ where: { id: { in: convoIds } } });

      // Jobs marketplace
      await tx.bid.deleteMany({ where: { OR: [{ mechanicId: userId }, { jobId: { in: jobIds } }] } });
      await tx.review.deleteMany({
        where: { OR: [{ reviewerId: userId }, { mechanicId: userId }, { jobId: { in: jobIds } }] },
      });
      // Other people's jobs this user was working as the mechanic: reopen
      // active ones (same as cancelJob), just detach completed ones.
      await tx.job.updateMany({
        where: { mechanicId: userId, status: { in: ["PENDING_CONFIRM", "IN_PROGRESS"] } },
        data: { mechanicId: null, acceptedBidId: null, status: "OPEN" },
      });
      await tx.job.updateMany({
        where: { mechanicId: userId },
        data: { mechanicId: null, acceptedBidId: null },
      });
      await tx.job.deleteMany({ where: { id: { in: jobIds } } });

      // Car shows
      await tx.carShowAttendee.deleteMany({ where: { OR: [{ userId }, { carShowId: { in: showIds } }] } });
      await tx.carShow.deleteMany({ where: { id: { in: showIds } } });

      // Garage / diagnostics
      await tx.savedDiagnosis.deleteMany({ where: { userId } });
      await tx.diagnosisLog.deleteMany({ where: { userId } });
      await tx.log.deleteMany({ where: { OR: [{ userId }, { vehicle: { userId } }] } });
      await tx.vehicle.deleteMany({ where: { userId } });

      // Listings and posts
      await tx.part.deleteMany({ where: { userId } });
      await tx.post.deleteMany({ where: { id: { in: postIds } } });

      // People this user referred keep their accounts.
      await tx.user.updateMany({ where: { referredById: userId }, data: { referredById: null } });

      await tx.user.delete({ where: { id: userId } });
    },
    { maxWait: 10000, timeout: 30000 }
  );
}
