import express from "express";
import {
    cancelJob,
    claimJob,
    completeJob,
    confirmJob,
    createJob,
    deleteJob,
    getJobs,
    getMyBids,
    getMyJobs,
    sendQuickAlert,
    sendStatusUpdate,
} from "../controllers/job.controller.js";
import { reportJob } from "../controllers/posts.controller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getJobs);
router.get("/mine", authMiddleware, getMyJobs);
router.get("/my-bids", authMiddleware, getMyBids);
router.post("/", authMiddleware, createJob);
router.delete("/:id", authMiddleware, deleteJob);
router.post("/:id/claim", authMiddleware, claimJob);
router.post("/:id/confirm", authMiddleware, confirmJob);
router.post("/:id/cancel", authMiddleware, cancelJob);
router.post("/:id/complete", authMiddleware, completeJob);
router.post("/:id/report", authMiddleware, reportJob);
router.post("/:id/status-update", authMiddleware, sendStatusUpdate);
router.post("/quick-alert", authMiddleware, sendQuickAlert);

export default router;