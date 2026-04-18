// src/controllers/comment.controller.js
import prisma from "../lib/prisma.js";
import * as CommentService from "../services/comment.service.js";

// GET a post and its comments
export const getPostWithComments = async (req, res) => {
  try {
    const postId = req.params.id;

    const post = await prisma.post.findUnique({
      where: { id: Number(postId) },
      include: {
        user: true,
      },
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const comments = await CommentService.getCommentsForPost(postId);

    res.json({ post, comments });
  } catch (err) {
    console.error("GET POST ERROR:", err);
    res.status(500).json({ error: "Failed to load post" });
  }
};

// ADD a comment to a post
export const addComment = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;
    const { content } = req.body;

    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "Comment cannot be empty" });
    }

    const newComment = await CommentService.createComment(
      postId,
      userId,
      content
    );

    res.json(newComment);
  } catch (err) {
    console.error("COMMENT ERROR:", err);
    res.status(500).json({ error: "Failed to add comment" });
  }
};