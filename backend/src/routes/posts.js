// src/routes/posts.js
import express from "express";
import * as postsController from "../controllers/posts.controller.js";
import { reportPost } from "../controllers/posts.controller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", postsController.getAllPosts);
router.get("/following", authMiddleware, postsController.getFollowingPosts);
router.get("/search", authMiddleware, postsController.searchPosts);
router.post("/", authMiddleware, postsController.createPost);
router.get("/:id", postsController.getPostById);
router.get("/:id/similar", authMiddleware, postsController.getSimilarPosts);
router.put("/:id", authMiddleware, postsController.updatePost);
router.delete("/:id", authMiddleware, postsController.deletePost);
router.post("/:id/like", authMiddleware, postsController.toggleLike);
router.post("/:id/comments", authMiddleware, postsController.addComment);
router.post("/:id/report", authMiddleware, reportPost);

export default router;