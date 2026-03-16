import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { getMe, updateProfile } from "../controllers/user.controller.js";

const router = express.Router();

router.get("/me", authenticateToken, getMe);
router.put("/me", authenticateToken, updateProfile);

export default router;