import prisma from "../lib/prisma.js";
import { TEST_ACCOUNT_EMAILS } from "../lib/testAccounts.js";
import { createAndSendNotification } from "./notification.controller.js";

// GET all posts
export const getAllPosts = async (req, res) => {
  try {
    const { type, search } = req.query;
    const viewerId = req.user?.id;
    const where = {
      user: { email: { notIn: TEST_ACCOUNT_EMAILS } },
    };
    if (type && type !== "ALL") where.postType = type;
    if (search) where.content = { contains: search, mode: "insensitive" };
    const posts = await prisma.post.findMany({
      where,
      orderBy: [
        {pinned: "desc"},
       { createdAt: "desc" },
      ],
      include: {
        user: { select: { id: true, name: true, profilePhoto: true, role: true, repPoints: true, isVerified: true } },
        comments: {
          where: {
            OR: [
              { user: { email: { notIn: TEST_ACCOUNT_EMAILS } } },
              { userId: viewerId },
            ],
          },
          include: { user: true, likes: true },
          orderBy: { createdAt: "asc" },
        },
        likes: {
          where: {
            OR: [
              { user: { email: { notIn: TEST_ACCOUNT_EMAILS } } },
              { userId: viewerId },
            ],
          },
        },
      },
    });
    res.json(posts);
  } catch (err) {
    console.error("GET ALL POSTS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
};

// GET a single post by ID
export const getPostById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const viewerId = req.user?.id;
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, profilePhoto: true, role: true, repPoints: true, isVerified: true } },
        comments: {
          where: {
            OR: [
              { user: { email: { notIn: TEST_ACCOUNT_EMAILS } } },
              { userId: viewerId },
            ],
          },
          include: { user: true, likes: true },
          orderBy: { createdAt: "asc" },
        },
        likes: {
          where: {
            OR: [
              { user: { email: { notIn: TEST_ACCOUNT_EMAILS } } },
              { userId: viewerId },
            ],
          },
        },
      },
    });
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  } catch (err) {
    console.error("GET POST ERROR:", err);
    res.status(500).json({ error: "Failed to fetch post" });
  }
};

// CREATE a post
export const createPost = async (req, res) => {
  try {
    const { content, imageUrl, imageUrls, postType, servicePrice, serviceLocation, beforeImageUrl, afterImageUrl } = req.body;
    const userId = req.user.id;
    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "Post content cannot be empty" });
    }
    const validTypes = ["VANITY", "QUESTION", "SERVICE", "BEFORE_AFTER"];
    const type = validTypes.includes(postType) ? postType : "VANITY";
    const post = await prisma.post.create({
      data: {
        content,
        userId,
        imageUrl: imageUrl || (imageUrls?.[0] || null),
        imageUrls: imageUrls || [],
        postType: type,
        servicePrice: servicePrice || null,
        serviceLocation: serviceLocation || null,
        beforeImageUrl: beforeImageUrl || null,
        afterImageUrl: afterImageUrl || null,
      },
    });

    const repToAward = type === "QUESTION" ? 2 : 1;
    await prisma.user.update({
      where: { id: userId },
      data: { repPoints: { increment: repToAward } },
    });

    res.json(post);
  } catch (err) {
    console.error("CREATE POST ERROR:", err);
    res.status(500).json({ error: "Failed to create post" });
  }
};

// UPDATE a post
export const updatePost = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { content } = req.body;
    const post = await prisma.post.update({ where: { id }, data: { content } });
    res.json(post);
  } catch (err) {
    console.error("UPDATE POST ERROR:", err);
    res.status(500).json({ error: "Failed to update post" });
  }
};

// DELETE a post
export const deletePost = async (req, res) => {
  try {
    const id = Number(req.params.id);

    await prisma.like.deleteMany({ where: { postId: id } });
    await prisma.comment.deleteMany({ where: { postId: id } });
    await prisma.report.deleteMany({ where: { postId: id } });
    await prisma.post.delete({ where: { id } });

    res.json({ message: "Post deleted" });
  } catch (err) {
    console.error("DELETE POST ERROR:", err);
    res.status(500).json({ error: "Failed to delete post" });
  }
};

// TOGGLE LIKE
export const toggleLike = async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const userId = req.user.id;

    const existing = await prisma.like.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (existing) {
      await prisma.like.delete({
        where: { postId_userId: { postId, userId } },
      });
      if (post && post.userId !== userId) {
        await prisma.user.update({
          where: { id: post.userId },
          data: { repPoints: { decrement: 2 } },
        });
      }
      return res.json({ liked: false });
    } else {
      await prisma.like.create({ data: { postId, userId } });

      if (post && post.userId !== userId) {
        await prisma.user.update({
          where: { id: post.userId },
          data: { repPoints: { increment: 2 } },
        });
      }

      res.json({ liked: true });

      if (post && post.userId !== userId) {
        (async () => {
          try {
            const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
            await createAndSendNotification({
              recipientId: post.userId,
              actorId: userId,
              type: "like",
              postId,
              message: `${actor?.name || "Someone"} liked your post ❤️`,
            });
          } catch (notifyErr) {
            console.error("LIKE NOTIFICATION ERROR:", notifyErr);
          }
        })();
      }
      return;
    }
  } catch (err) {
    console.error("TOGGLE LIKE ERROR:", err);
    res.status(500).json({ error: "Failed to toggle like" });
  }
};

// ADD COMMENT
export const addComment = async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const userId = req.user.id;
    const { content } = req.body;

    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "Comment content cannot be empty" });
    }

    const comment = await prisma.comment.create({
      data: { content, userId, postId },
      include: { user: true },
    });

    res.json(comment);

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (post && post.userId !== userId) {
      (async () => {
        try {
          await prisma.user.update({
            where: { id: post.userId },
            data: { repPoints: { increment: 1 } },
          });

          const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
          await createAndSendNotification({
            recipientId: post.userId,
            actorId: userId,
            type: "comment",
            postId,
            message: `${actor?.name || "Someone"} commented on your post 💬`,
          });
        } catch (notifyErr) {
          console.error("COMMENT NOTIFICATION ERROR:", notifyErr);
        }
      })();
    }
  } catch (err) {
    console.error("ADD COMMENT ERROR:", err);
    res.status(500).json({ error: "Failed to add comment" });
  }
};

// ADD REPLY (a comment with a parentId)
export const addReply = async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const parentId = Number(req.params.commentId);
    const userId = req.user.id;
    const { content } = req.body;

    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "Reply cannot be empty" });
    }

    const reply = await prisma.comment.create({
      data: { content, userId, postId, parentId },
      include: { user: true },
    });

    res.json(reply);

    (async () => {
      try {
        const parentComment = await prisma.comment.findUnique({
          where: { id: parentId },
          select: { userId: true },
        });

        if (parentComment && parentComment.userId !== userId) {
          const actor = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          });
          await createAndSendNotification({
            recipientId: parentComment.userId,
            actorId: userId,
            type: "comment",
            postId,
            message: `${actor?.name || "Someone"} replied to your comment 💬`,
          });
        }
      } catch (notifyErr) {
        console.error("REPLY NOTIFICATION ERROR:", notifyErr);
      }
    })();
  } catch (err) {
    console.error("ADD REPLY ERROR:", err);
    res.status(500).json({ error: "Failed to add reply" });
  }
};

// TOGGLE LIKE ON A COMMENT
export const toggleCommentLike = async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    const userId = req.user.id;

    const existing = await prisma.like.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    if (existing) {
      await prisma.like.delete({
        where: { commentId_userId: { commentId, userId } },
      });
      return res.json({ liked: false });
    } else {
      await prisma.like.create({ data: { commentId, userId } });

      res.json({ liked: true });

      if (comment.userId !== userId) {
        (async () => {
          try {
            const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
            await createAndSendNotification({
              recipientId: comment.userId,
              actorId: userId,
              type: "comment_like",
              postId: comment.postId,
              message: `${actor?.name || "Someone"} liked your comment ❤️`,
            });
          } catch (notifyErr) {
            console.error("COMMENT LIKE NOTIFICATION ERROR:", notifyErr);
          }
        })();
      }
      return;
    }
  } catch (err) {
    console.error("TOGGLE COMMENT LIKE ERROR:", err);
    res.status(500).json({ error: "Failed to toggle comment like" });
  }
};

// DELETE a comment or reply
export const deleteComment = async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    const userId = req.user.id;

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    if (comment.userId !== userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
      if (!user?.isAdmin) {
        return res.status(403).json({ error: "Not authorized to delete this comment" });
      }
    }

    const replies = await prisma.comment.findMany({ where: { parentId: commentId }, select: { id: true } });
    const replyIds = replies.map((r) => r.id);

    await prisma.like.deleteMany({ where: { commentId: { in: [commentId, ...replyIds] } } });
    if (replyIds.length > 0) {
      await prisma.comment.deleteMany({ where: { id: { in: replyIds } } });
    }
    await prisma.comment.delete({ where: { id: commentId } });

    res.json({ message: "Comment deleted" });
  } catch (err) {
    console.error("DELETE COMMENT ERROR:", err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
};

// GET FOLLOWING POSTS
export const getFollowingPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query;
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);
    const where = {
      userId: { in: followingIds },
      ...(type && type !== "ALL" ? { postType: type } : {}),
    };
    const posts = await prisma.post.findMany({
      where,
      orderBy: [
        { pinned: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        user: { select: { id: true, name: true, profilePhoto: true, role: true, repPoints: true, isVerified: true } },
        comments: {
          where: {
            OR: [
              { user: { email: { notIn: TEST_ACCOUNT_EMAILS } } },
              { userId },
            ],
          },
          include: { user: true, likes: true },
          orderBy: { createdAt: "asc" },
        },
        likes: {
          where: {
            OR: [
              { user: { email: { notIn: TEST_ACCOUNT_EMAILS } } },
              { userId },
            ],
          },
        },
      },
    });
    res.json(posts);
  } catch (err) {
    console.error("GET FOLLOWING POSTS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch following posts" });
  }
};

// REPORT POST
export const reportPost = async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const reporterId = req.user.id;
    const { reason } = req.body;

    if (!reason || reason.trim() === "") {
      return res.status(400).json({ error: "Reason is required" });
    }

    const existing = await prisma.report.findFirst({
      where: { reporterId, postId },
    });

    if (existing) {
      return res.status(400).json({ error: "You already reported this post" });
    }

    await prisma.report.create({
      data: { reporterId, postId, reason },
    });

    try {
      const post = await prisma.post.findUnique({ where: { id: postId }, select: { content: true } });
      const admins = await prisma.user.findMany({
        where: { isAdmin: true },
        select: { id: true },
      });
      await Promise.all(admins.map(admin =>
        createAndSendNotification({
          recipientId: admin.id,
          actorId: reporterId,
          type: "post_reported",
          postId,
          message: `🚨 Post reported — Reason: ${reason}${post?.content ? ` | "${post.content.slice(0, 60)}${post.content.length > 60 ? "..." : ""}"` : ""}`,
        })
      ));
    } catch (notifyErr) {
      console.error("REPORT POST NOTIFY ADMIN ERROR:", notifyErr);
    }

    res.json({ success: true, message: "Post reported successfully" });
  } catch (err) {
    console.error("REPORT POST ERROR:", err);
    res.status(500).json({ error: "Failed to report post" });
  }
};

// REPORT JOB
export const reportJob = async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const reporterId = req.user.id;
    const { reason } = req.body;

    if (!reason || reason.trim() === "") {
      return res.status(400).json({ error: "Reason is required" });
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ error: "Job not found" });

    const existing = await prisma.report.findFirst({
      where: { reporterId, jobId },
    });
    if (existing) {
      return res.status(400).json({ error: "You already reported this job" });
    }

    await prisma.report.create({
      data: { reporterId, jobId, reason },
    });

    const admins = await prisma.user.findMany({
      where: { isAdmin: true },
      select: { id: true },
    });
    await Promise.all(admins.map(admin =>
      createAndSendNotification({
        recipientId: admin.id,
        actorId: reporterId,
        type: "job_update",
        message: `🚨 Job reported: "${job.title}" — Reason: ${reason}`,
      })
    ));

    res.json({ success: true, message: "Job reported successfully" });
  } catch (err) {
    console.error("REPORT JOB ERROR:", err);
    res.status(500).json({ error: "Failed to report job" });
  }
};

// SEARCH POSTS
export const searchPosts = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }
    const posts = await prisma.post.findMany({
      where: {
        content: {
          contains: q,
          mode: "insensitive",
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, profilePhoto: true, role: true, repPoints: true, isVerified: true } },
        likes: true,
        comments: true,
      },
    });
    res.json(posts);
  } catch (err) {
    console.error("SEARCH POSTS ERROR:", err);
    res.status(500).json({ error: "Failed to search posts" });
  }
};

// GET SIMILAR POSTS
export const getSimilarPosts = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const similar = await prisma.post.findMany({
      where: {
        postType: post.postType,
        id: { not: id },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { id: true, name: true, profilePhoto: true, role: true } },
        likes: true,
        comments: true,
      },
    });

    res.json(similar);
  } catch (err) {
    console.error("GET SIMILAR POSTS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch similar posts" });
  }
};

// PIN / UNPIN a post (admin only)
export const togglePinPost = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const updated = await prisma.post.update({
      where: { id },
      data: { pinned: !post.pinned },
    });

    res.json({ pinned: updated.pinned });
  } catch (err) {
    console.error("TOGGLE PIN ERROR:", err);
    res.status(500).json({ error: "Failed to toggle pin" });
  }
};