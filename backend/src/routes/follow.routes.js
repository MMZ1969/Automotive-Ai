import express from "express";
import * as followController from "../controllers/follow.controller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/:id/follow", authMiddleware, followController.toggleFollow);
router.get("/:id/follow-status", authMiddleware, followController.getFollowStatus);

export default router;