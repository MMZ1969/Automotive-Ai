import express from "express";
import {
  completeReminder,
  createReminder,
  deleteReminder,
  listReminders,
  updateReminder,
} from "../controllers/reminders.controller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/", listReminders);
router.post("/", createReminder);
router.put("/:id", updateReminder);
router.post("/:id/done", completeReminder);
router.delete("/:id", deleteReminder);

export default router;
