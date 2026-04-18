import express from "express";
import { register, login, me } from "./auth.controller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// REGISTER
router.post("/register", register);

// LOGIN
router.post("/login", login);

// RESTORE SESSION
router.get("/me", authMiddleware, me);

export default router;