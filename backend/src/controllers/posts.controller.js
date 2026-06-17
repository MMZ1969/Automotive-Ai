import prisma from "../lib/prisma.js";
import { createAndSendNotification } from "./notification.controller.js";

// GET all posts
export const getAllPosts = async (req, res) => {
  try {
    const { type } = req.query;
    const where = type && type !== "ALL" ? { postType: type } : {};
    const posts = await prisma.post.findMany({
      where,
      orderBy: [
        {pinned: "desc"},
       { createdAt: "desc" },
      ],
      include: {
        user: { select: { id: true, name: true, profilePhoto: true, role: true, repPoints: true, isVerified: true } },
        comments: { include: { user: true }, orderBy: { createdAt: "asc" } },
        likes: true,
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
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, profilePhoto: true, role: true, repPoints: true, isVerified: true } },
        comments: { include: { user: true }, orderBy: { createdAt: "asc" } },
        likes: true,
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
    console.log("CREATE POST BODY:", req.body);
    console.log("POST TYPE RECEIVED:", req.body.postType);
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

    // Award rep for posting
    const repToAward = type === "QUESTION" ? 2 : 1;
    await prisma.user.update({
      where: { id: userId },
      data: { repPoints: { increment: repToAward } },
    });

res.json(post);
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

    // Delete related records first
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

        const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        await createAndSendNotification({
          recipientId: post.userId,
          actorId: userId,
          type: "like",
          postId,
          message: `${actor?.name || "Someone"} liked your post ❤️`,
        });
      }
      return res.json({ liked: true });
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

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (post && post.userId !== userId) {
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
    }

    res.json(comment);
  } catch (err) {
    console.error("ADD COMMENT ERROR:", err);
    res.status(500).json({ error: "Failed to add comment" });
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
        comments: { include: { user: true }, orderBy: { createdAt: "asc" } },
        likes: true,
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

    const existing = await prisma.report.findUnique({
      where: { reporterId_postId: { reporterId, postId } },
    });

    if (existing) {
      return res.status(400).json({ error: "You already reported this post" });
    }

    await prisma.report.create({
      data: { reporterId, postId, reason },
    });

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

    // Notify admin
    const admins = await prisma.user.findMany({
      where: { isAdmin: true },
      select: { id: true },
    });
    const { createAndSendNotification } = await import("./notification.controller.js");
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

    // Notify the parent comment author (if not replying to yourself)
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

    res.json(reply);
  } catch (err) {
    console.error("ADD REPLY ERROR:", err);
    res.status(500).json({ error: "Failed to add reply" });
  }
};