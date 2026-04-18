import express from "express";
import { getMe, updateProfile } from "../controllers/user.controller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /users/me
router.get("/me", authMiddleware, getMe);

// PUT /users/me
router.put("/me", authMiddleware, updateProfile);

export default router;