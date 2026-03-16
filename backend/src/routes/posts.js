// src/routes/posts.js
import express from "express";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import {
  getPostWithComments,
  addComment,
} from "../controllers/comment.controller.js";

const router = express.Router();

// Get all posts
router.get("/", async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
      },
    });

    res.json(posts);
  } catch (err) {
    console.error("GET POSTS ERROR:", err);
    res.status(500).json({ error: "Failed to load posts" });
  }
});

// Get single post + comments
router.get("/:id", getPostWithComments);

// Add comment to post
router.post("/:id/comments", authenticateToken, addComment);

export default router;