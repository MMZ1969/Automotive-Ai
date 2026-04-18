// src/controllers/posts.controller.js
import prisma from "../lib/prisma.js";

// GET all posts
export const getAllPosts = async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
        comments: true,
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
        comments: true,
      },
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json(post);
  } catch (err) {
    console.error("GET POST ERROR:", err);
    res.status(500).json({ error: "Failed to fetch post" });
  }
};

// CREATE a post
export const createPost = async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "Post content cannot be empty" });
    }

    const post = await prisma.post.create({
      data: {
        content,
        userId,
      },
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

    const post = await prisma.post.update({
      where: { id },
      data: { content },
    });

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

    await prisma.post.delete({
      where: { id },
    });

    res.json({ message: "Post deleted" });
  } catch (err) {
    console.error("DELETE POST ERROR:", err);
    res.status(500).json({ error: "Failed to delete post" });
  }
};