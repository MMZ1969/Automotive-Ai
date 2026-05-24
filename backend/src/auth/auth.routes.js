import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
    changePassword,
    deleteAccount,
    forgotPassword,
    login,
    me,
    register,
    resendVerification,
    resetPassword,
    verifyEmail,
} from "./auth.controller.js";

const router = express.Router();

// REGISTER
router.post("/register", register);

// LOGIN
router.post("/login", login);

// RESTORE SESSION
router.get("/me", authMiddleware, me);

// DELETE ACCOUNT
router.delete("/account", authMiddleware, deleteAccount);

// FORGOT PASSWORD
router.post("/forgot-password", forgotPassword);

// RESET PASSWORD
router.post("/reset-password", resetPassword);

// CHANGE PASSWORD
router.put("/change-password", authMiddleware, changePassword);

// VERIFY EMAIL
router.get("/verify-email", verifyEmail);

// RESEND VERIFICATION
router.post("/resend-verification", resendVerification);

export default router;