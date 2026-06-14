import express from "express";
import { deleteAllNotifications, deleteNotification, getNotifications, getUnreadCount, markAllRead } from "../controllers/notification.controller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getNotifications);
router.get("/unread-count", authMiddleware, getUnreadCount);
router.post("/mark-read", authMiddleware, markAllRead);
router.delete("/:id", authMiddleware, deleteNotification);
router.delete("/", authMiddleware, deleteAllNotifications);

export default router;