import prisma from "../lib/prisma.js";

// GET all posts
export const getAllPosts = async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
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
        user: true,
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
    const { content, imageUrl } = req.body;
    const userId = req.user.id;
    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "Post content cannot be empty" });
    }
    const post = await prisma.post.create({
      data: { content, userId, imageUrl },
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

        // Create like notification
        const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        await prisma.notification.create({
          data: {
            recipientId: post.userId,
            actorId: userId,
            type: "like",
            postId,
            message: `${actor?.name || "Someone"} liked your post ❤️`,
          },
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

      // Create comment notification
      const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      await prisma.notification.create({
        data: {
          recipientId: post.userId,
          actorId: userId,
          type: "comment",
          postId,
          message: `${actor?.name || "Someone"} commented on your post 💬`,
        },
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
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);
    const posts = await prisma.post.findMany({
      where: { userId: { in: followingIds } },
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
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