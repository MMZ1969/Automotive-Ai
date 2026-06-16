import express from "express";
import { banUser, blockUser, getAllUsers, getBlockedUsers, getFollowers, getFollowing, getLeaderboard, getMe, getMechanicStats, getMechanics, getUserProfile, getVerificationRequests, requestVerification, savePushToken, searchUsers, updateProfile, verifyMechanic } from "../controllers/user.controller.js";
import prisma from "../lib/prisma.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/leaderboard", authMiddleware, getLeaderboard);
router.get("/me", authMiddleware, getMe);
router.put("/me", authMiddleware, updateProfile);
router.get("/search", authMiddleware, searchUsers);
router.get("/blocked", authMiddleware, getBlockedUsers);
router.get("/mechanics", authMiddleware, getMechanics);
router.get("/admin/all", authMiddleware, getAllUsers);
router.post("/:id/ban", authMiddleware, banUser);
router.get("/:id/profile", authMiddleware, getUserProfile);
router.get("/:id/mechanic-stats", authMiddleware, getMechanicStats);
router.post("/push-token", authMiddleware, savePushToken);
router.post("/availability", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { isAvailable: !user.isAvailable },
    });
    res.json({ isAvailable: updated.isAvailable });
  } catch (err) {
    console.error("TOGGLE AVAILABILITY ERROR:", err);
    res.status(500).json({ error: "Failed to update availability" });
  }
});
router.post("/:id/block", authMiddleware, blockUser);
router.get("/:id/followers", authMiddleware, getFollowers);
router.get("/:id/following", authMiddleware, getFollowing);
router.post("/verification-request", authMiddleware, requestVerification);
router.get("/verification-requests", authMiddleware, getVerificationRequests);
router.post("/:id/verify", authMiddleware, verifyMechanic);

export default router;