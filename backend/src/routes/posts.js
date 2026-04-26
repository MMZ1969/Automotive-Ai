// src/routes/posts.js
import express from "express";
import * as postsController from "../controllers/posts.controller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", postsController.getAllPosts);
router.get("/following", authMiddleware, postsController.getFollowingPosts);
router.post("/", authMiddleware, postsController.createPost);
router.get("/:id", postsController.getPostById);
router.put("/:id", authMiddleware, postsController.updatePost);
router.delete("/:id", authMiddleware, postsController.deletePost);
router.post("/:id/like", authMiddleware, postsController.toggleLike);
router.post("/:id/comments", authMiddleware, postsController.addComment);

export default router;