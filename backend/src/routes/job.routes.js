import express from "express";
import {
    acceptBid,
    completeJob,
    createJob,
    deleteJob,
    getJobs,
    getMyBids,
    getMyJobs,
    placeBid,
} from "../controllers/job.controller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getJobs);
router.get("/mine", authMiddleware, getMyJobs);
router.get("/my-bids", authMiddleware, getMyBids);
router.post("/", authMiddleware, createJob);
router.delete("/:id", authMiddleware, deleteJob);
router.post("/:id/bid", authMiddleware, placeBid);
router.post("/:id/bids/:bidId/accept", authMiddleware, acceptBid);
router.post("/:id/complete", authMiddleware, completeJob);

export default router;