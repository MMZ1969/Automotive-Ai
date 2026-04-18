// src/routes/posts.js
import express from "express";
import * as postsController from "../controllers/posts.controller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Adjust these to match your actual controller exports.
// These are the most common patterns.
router.get("/", postsController.getAllPosts);
router.post("/", authMiddleware, postsController.createPost);
router.get("/:id", postsController.getPostById);
router.put("/:id", authMiddleware, postsController.updatePost);
router.delete("/:id", authMiddleware, postsController.deletePost);
router.post("/:id/like", authMiddleware, postsController.toggleLike);

export default router;