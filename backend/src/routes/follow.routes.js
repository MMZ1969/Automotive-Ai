import express from "express";
import * as followController from "../controllers/follow.controller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/:id/follow", authMiddleware, followController.toggleFollow);
router.get("/:id/follow-status", authMiddleware, followController.getFollowStatus);
router.get("/:id/followers", authMiddleware, followController.getFollowers);
router.get("/:id/following", authMiddleware, followController.getFollowing);

export default router;