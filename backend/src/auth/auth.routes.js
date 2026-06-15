import express from "express";
import rateLimit from "express-rate-limit";
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
    resetPasswordRedirect,
    verifyEmail,
} from "./auth.controller.js";

const router = express.Router();

// Limit registration attempts: 5 per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { message: "Too many registration attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limit password reset / resend verification: 5 per hour per IP
const emailActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// REGISTER
router.post("/register", registerLimiter, register);

// LOGIN
router.post("/login", login);

// RESTORE SESSION
router.get("/me", authMiddleware, me);

// DELETE ACCOUNT
router.delete("/account", authMiddleware, deleteAccount);

// FORGOT PASSWORD
router.post("/forgot-password", emailActionLimiter, forgotPassword);

// RESET PASSWORD
router.post("/reset-password", resetPassword);

// CHANGE PASSWORD
router.put("/change-password", authMiddleware, changePassword);

// VERIFY EMAIL
router.get("/verify-email", verifyEmail);

router.get("/reset-password-redirect", resetPasswordRedirect);

// RESEND VERIFICATION
router.post("/resend-verification", emailActionLimiter, resendVerification);

export default router;