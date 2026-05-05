import prisma from "../lib/prisma.js";
import { createAndSendNotification } from "./notification.controller.js";

// GET all jobs (mechanic view)
export const getJobs = async (req, res) => {
  try {
    console.log("GET JOBS HIT - user:", req.user);

    const all = await prisma.job.findMany();
    console.log("RAW JOB COUNT:", all.length);

    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        poster: { select: { id: true, name: true, profilePhoto: true, role: true } },
        bids: {
          include: {
            mechanic: { select: { id: true, name: true, profilePhoto: true, repPoints: true } },
          },
        },
      },
    });

    console.log("JOBS WITH INCLUDES COUNT:", jobs.length);
    res.json(jobs);
  } catch (err) {
    console.error("GET JOBS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
};

// GET my jobs (as DIYer)
export const getMyJobs = async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        poster: { select: { id: true, name: true, profilePhoto: true } },
        bids: {
          include: {
            mechanic: { select: { id: true, name: true, profilePhoto: true, repPoints: true } },
          },
        },
      },
    });
    res.json(jobs);
  } catch (err) {
    console.error("GET MY JOBS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch your jobs" });
  }
};

// GET my bids (as Mechanic)
export const getMyBids = async (req, res) => {
  try {
    const bids = await prisma.bid.findMany({
      where: { mechanicId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        job: {
          include: {
            poster: { select: { id: true, name: true, profilePhoto: true } },
          },
        },
      },
    });
    res.json(bids);
  } catch (err) {
    console.error("GET MY BIDS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch your bids" });
  }
};

// CREATE a job
export const createJob = async (req, res) => {
  try {
    const { title, description, vehicle, budget, location } = req.body;
    const userId = req.user.id;

    if (!title || !description || !vehicle) {
      return res.status(400).json({ error: "Title, description and vehicle are required" });
    }

    const job = await prisma.job.create({
      data: { title, description, vehicle, budget: budget ? Number(budget) : null, location, userId },
      include: {
        poster: { select: { id: true, name: true, profilePhoto: true } },
        bids: [],
      },
    });

    // Notify all mechanics about new job
    try {
      const mechanics = await prisma.user.findMany({
        where: { role: "MECHANIC" },
        select: { id: true },
      });

      await Promise.all(
        mechanics
          .filter(m => m.id !== userId)
          .map(m =>
            createAndSendNotification({
              recipientId: m.id,
              actorId: userId,
              type: "bid",
              message: `🔧 New job posted: ${title} — tap to view and bid!`,
            })
          )
      );
    } catch (notifErr) {
      console.error("NOTIFY MECHANICS ERROR:", notifErr);
      // silently fail — don't block job creation
    }

    res.json(job);
  } catch (err) {
    console.error("CREATE JOB ERROR:", err);
    res.status(500).json({ error: "Failed to create job" });
  }
};

// DELETE a job
export const deleteJob = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const job = await prisma.job.findUnique({ where: { id } });

    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.userId !== req.user.id) return res.status(403).json({ error: "Not authorized" });

    await prisma.bid.deleteMany({ where: { jobId: id } });
    await prisma.job.delete({ where: { id } });

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE JOB ERROR:", err);
    res.status(500).json({ error: "Failed to delete job" });
  }
};

// PLACE a bid on a job
export const placeBid = async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const mechanicId = req.user.id;
    const { message, price } = req.body;

    if (!message || !price) {
      return res.status(400).json({ error: "Message and price are required" });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { poster: { select: { id: true, name: true } } },
    });

    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.status !== "OPEN") return res.status(400).json({ error: "Job is no longer open" });
    if (job.userId === mechanicId) return res.status(400).json({ error: "Cannot bid on your own job" });

    const existing = await prisma.bid.findUnique({
      where: { jobId_mechanicId: { jobId, mechanicId } },
    });
    if (existing) return res.status(400).json({ error: "You already bid on this job" });

    const bid = await prisma.bid.create({
      data: { jobId, mechanicId, message, price: Number(price) },
      include: {
        mechanic: { select: { id: true, name: true, profilePhoto: true, repPoints: true } },
      },
    });

    const mechanic = await prisma.user.findUnique({ where: { id: mechanicId }, select: { name: true } });
    await createAndSendNotification({
      recipientId: job.userId,
      actorId: mechanicId,
      type: "bid",
      message: `${mechanic?.name || "A mechanic"} placed a bid on your job: ${job.title} 🔧`,
    });

    res.json(bid);
  } catch (err) {
    console.error("PLACE BID ERROR:", err);
    res.status(500).json({ error: "Failed to place bid" });
  }
};

// ACCEPT a bid
export const acceptBid = async (req, res) => {
  try {
    const bidId = Number(req.params.bidId);
    const userId = req.user.id;

    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
      include: { job: true },
    });

    if (!bid) return res.status(404).json({ error: "Bid not found" });
    if (bid.job.userId !== userId) return res.status(403).json({ error: "Not authorized" });

    await prisma.job.update({
      where: { id: bid.jobId },
      data: { status: "IN_PROGRESS", acceptedBidId: bidId },
    });

    await prisma.bid.update({
      where: { id: bidId },
      data: { status: "ACCEPTED" },
    });

    await prisma.bid.updateMany({
      where: { jobId: bid.jobId, id: { not: bidId } },
      data: { status: "REJECTED" },
    });

    const poster = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true  },
    });

    await createAndSendNotification({
  recipientId: bid.mechanicId,
  actorId: userId,
  type: "bid_accepted",
  message: `${poster?.name || "Someone"} accepted your bid! 🎉 Contact them at ${poster?.phone || poster?.email} to get started.`,
});

    res.json({ success: true });
  } catch (err) {
    console.error("ACCEPT BID ERROR:", err);
    res.status(500).json({ error: "Failed to accept bid" });
  }
};

// COMPLETE a job
export const completeJob = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.id;

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.userId !== userId) return res.status(403).json({ error: "Not authorized" });

    await prisma.job.update({
      where: { id },
      data: { status: "COMPLETED" },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("COMPLETE JOB ERROR:", err);
    res.status(500).json({ error: "Failed to complete job" });
  }
};
