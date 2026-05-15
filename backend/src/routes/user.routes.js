import express from "express";
import { blockUser, getBlockedUsers, getFollowers, getFollowing, getLeaderboard, getMe, getMechanicStats, getUserProfile, savePushToken, searchUsers, updateProfile } from "../controllers/user.controller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/leaderboard", authMiddleware, getLeaderboard);
router.get("/me", authMiddleware, getMe);
router.put("/me", authMiddleware, updateProfile);
router.get("/search", authMiddleware, searchUsers);
router.get("/blocked", authMiddleware, getBlockedUsers);
router.get("/:id/profile", authMiddleware, getUserProfile);
router.get("/:id/mechanic-stats", authMiddleware, getMechanicStats);
router.post("/push-token", authMiddleware, savePushToken);
router.post("/:id/block", authMiddleware, blockUser);
router.get("/:id/followers", authMiddleware, getFollowers);
router.get("/:id/following", authMiddleware, getFollowing);

export default router;