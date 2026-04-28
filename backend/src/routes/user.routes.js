import express from "express";
import { getLeaderboard, getMe, getUserProfile, savePushToken, searchUsers, updateProfile } from "../controllers/user.controller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/leaderboard", authMiddleware, getLeaderboard);
router.get("/me", authMiddleware, getMe);
router.put("/me", authMiddleware, updateProfile);
router.get("/search", authMiddleware, searchUsers);
router.get("/:id/profile", authMiddleware, getUserProfile);
router.post("/push-token", authMiddleware, savePushToken);

export default router;