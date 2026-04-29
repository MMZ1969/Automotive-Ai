import { PrismaClient } from "@prisma/client";
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/reviews — submit a review
router.post("/", authMiddleware, async (req, res) => {
  const { jobId, mechanicId, rating, comment } = req.body;
  const reviewerId = req.user.id;

  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.userId !== reviewerId) return res.status(403).json({ error: "Only the job poster can leave a review" });
    if (job.status !== "COMPLETED") return res.status(400).json({ error: "Job must be completed first" });

    const review = await prisma.review.create({
      data: { jobId, reviewerId, mechanicId, rating, comment },
    });
    res.json(review);
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ error: "Already reviewed this job" });
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/reviews/:mechanicId — get a mechanic's reviews
router.get("/:mechanicId", async (req, res) => {
  const mechanicId = parseInt(req.params.mechanicId);
  try {
    const reviews = await prisma.review.findMany({
      where: { mechanicId },
      include: {
        reviewer: { select: { id: true, name: true, profilePhoto: true } },
        job: { select: { id: true, title: true, vehicle: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const avgRating = reviews.length
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({ reviews, avgRating: Math.round(avgRating * 10) / 10, total: reviews.length });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;