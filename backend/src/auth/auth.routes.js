import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { deleteAccount, login, me, register } from "./auth.controller.js";

const router = express.Router();

// REGISTER
router.post("/register", register);

// LOGIN
router.post("/login", login);

// RESTORE SESSION
router.get("/me", authMiddleware, me);

// DELETE ACCOUNT
router.delete("/account", authMiddleware, deleteAccount);

export default router;