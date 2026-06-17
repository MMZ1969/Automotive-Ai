import prisma from "../lib/prisma.js";
import { createAndSendNotification } from "./notification.controller.js";

// GET all jobs (mechanic + diyer map view)
export const getJobs = async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      include: {
        poster: { select: { id: true, name: true, profilePhoto: true, role: true } },
        mechanic: { select: { id: true, name: true, profilePhoto: true } },
      },
    });
    res.json(jobs);
  } catch (err) {
    console.error("GET JOBS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
};

// GET my jobs (DIYer)
export const getMyJobs = async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        poster: { select: { id: true, name: true, profilePhoto: true } },
        mechanic: { select: { id: true, name: true, profilePhoto: true, phone: true, email: true } },
      },
    });
    res.json(jobs);
  } catch (err) {
    console.error("GET MY JOBS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch your jobs" });
  }
};

// GET my claimed jobs (Mechanic)
export const getMyBids = async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { mechanicId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        poster: { select: { id: true, name: true, profilePhoto: true, phone: true, email: true } },
        mechanic: { select: { id: true, name: true, profilePhoto: true } },
      },
    });
    res.json(jobs);
  } catch (err) {
    console.error("GET MY JOBS (MECHANIC) ERROR:", err);
    res.status(500).json({ error: "Failed to fetch your jobs" });
  }
};

// CREATE a job
export const createJob = async (req, res) => {
  try {
    const { title, description, vehicle, budget, location, latitude, longitude } = req.body;
    const userId = req.user.id;

    if (!title || !description || !vehicle) {
      return res.status(400).json({ error: "Title, description and vehicle are required" });
    }

    const job = await prisma.job.create({
      data: {
        title, description, vehicle,
        budget: budget ? Number(budget) : null,
        location,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        userId,
      },
      include: {
        poster: { select: { id: true, name: true, profilePhoto: true } },
      },
    });

    // Notify all mechanics
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
              type: "job",
              jobId: job.id,
              message: `🔧 New job posted near you: ${title} — tap to view on the map!`,
            })
          )
      );
    } catch (notifErr) {
      console.error("NOTIFY MECHANICS ERROR:", notifErr);
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
    await prisma.review.deleteMany({ where: { jobId: id } });
    await prisma.job.delete({ where: { id } });

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE JOB ERROR:", err);
    res.status(500).json({ error: "Failed to delete job" });
  }
};

// CLAIM a job (mechanic taps it on map)
export const claimJob = async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const mechanicId = req.user.id;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { poster: { select: { id: true, name: true } } },
    });

    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.status !== "OPEN") return res.status(400).json({ error: "Job is no longer open" });
    if (job.userId === mechanicId) return res.status(400).json({ error: "Cannot claim your own job" });
    if (job.mechanicId) return res.status(400).json({ error: "Job already claimed" });

    // Set mechanic but keep status OPEN until DIYer confirms
    await prisma.job.update({
      where: { id: jobId },
      data: { mechanicId, status: "PENDING_CONFIRM" },
    });

    const mechanic = await prisma.user.findUnique({
      where: { id: mechanicId },
      select: { name: true },
    });

    // Notify the DIYer
    await createAndSendNotification({
      recipientId: job.userId,
      actorId: mechanicId,
      type: "job",
      jobId: job.id,
      message: `🔧 ${mechanic?.name || "A mechanic"} wants to take your job: "${job.title}" — tap to confirm!`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("CLAIM JOB ERROR:", err);
    res.status(500).json({ error: "Failed to claim job" });
  }
};

// CONFIRM a mechanic (DIYer confirms after claim)
export const confirmJob = async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const userId = req.user.id;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        mechanic: { select: { id: true, name: true, phone: true, email: true } },
        poster: { select: { id: true, name: true, phone: true, email: true } },
      },
    });

    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.userId !== userId) return res.status(403).json({ error: "Not authorized" });
    if (job.status !== "PENDING_CONFIRM") return res.status(400).json({ error: "Job is not pending confirmation" });
    if (!job.mechanicId) return res.status(400).json({ error: "No mechanic to confirm" });

    await prisma.job.update({
      where: { id: jobId },
      data: { status: "IN_PROGRESS" },
    });

    // Notify the mechanic
    await createAndSendNotification({
      recipientId: job.mechanicId,
      actorId: userId,
      type: "job",
      jobId: job.id,
      message: `✅ ${job.poster.name} confirmed your claim on "${job.title}"! Contact: ${job.poster.phone || job.poster.email}`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("CONFIRM JOB ERROR:", err);
    res.status(500).json({ error: "Failed to confirm job" });
  }
};

// COMPLETE a job
export const completeJob = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.id;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        mechanic: { select: { id: true, name: true } },
        poster: { select: { id: true, name: true } },
      },
    });

    if (!job) return res.status(404).json({ error: "Job not found" });

    const isMechanic = job.mechanicId === userId;
    const isDIYer = job.userId === userId;

    if (!isMechanic && !isDIYer) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await prisma.job.update({
      where: { id },
      data: { status: "COMPLETED" },
    });

    if (isMechanic && job.mechanic) {
      await createAndSendNotification({
        recipientId: job.userId,
        actorId: userId,
        type: "job_complete",
        jobId: job.id,
        message: `🏁 ${job.mechanic.name} marked your job "${job.title}" as complete! Please leave a review.`,
      });
    }

    if (isDIYer && job.mechanic) {
      await createAndSendNotification({
        recipientId: job.mechanic.id,
        actorId: userId,
        type: "job_complete",
        jobId: job.id,
        message: `🏁 ${job.poster.name} marked "${job.title}" as complete! Please rate your customer.`,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("COMPLETE JOB ERROR:", err);
    res.status(500).json({ error: "Failed to complete job" });
  }
};

// STATUS UPDATE (mechanic sends preset message to customer)
export const sendStatusUpdate = async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const mechanicId = req.user.id;
    const { message } = req.body;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { poster: { select: { id: true, name: true } } },
    });

    if (!job) return res.status(404).json({ error: "Job not found" });

    const mechanic = await prisma.user.findUnique({
      where: { id: mechanicId },
      select: { name: true },
    });

    await createAndSendNotification({
      recipientId: job.userId,
      actorId: mechanicId,
      type: "job_update",
      message: `🔧 ${mechanic?.name || "Your mechanic"}: ${message}`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("STATUS UPDATE ERROR:", err);
    res.status(500).json({ error: "Failed to send status update" });
  }
};

// QUICK ALERT
export const sendQuickAlert = async (req, res) => {
  try {
    const mechanicId = req.user.id;
    const { customerId, message } = req.body;

    if (!customerId || !message) {
      return res.status(400).json({ error: "Customer ID and message are required" });
    }

    const mechanic = await prisma.user.findUnique({
      where: { id: mechanicId },
      select: { name: true, role: true },
    });

    if (mechanic?.role !== "MECHANIC") {
      return res.status(403).json({ error: "Only mechanics can send quick alerts" });
    }

    const customer = await prisma.user.findUnique({ where: { id: Number(customerId) } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    await createAndSendNotification({
      recipientId: Number(customerId),
      actorId: mechanicId,
      type: "job_update",
      message: `🔧 ${mechanic?.name || "Your mechanic"}: ${message}`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("QUICK ALERT ERROR:", err);
    res.status(500).json({ error: "Failed to send quick alert" });
  }
};
  // CANCEL a job (DIYer cancels after claiming/confirming)
export const cancelJob = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.id;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        mechanic: { select: { id: true, name: true } },
        poster: { select: { id: true, name: true } },
      },
    });

    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.userId !== userId) return res.status(403).json({ error: "Not authorized" });
    if (job.status === "COMPLETED") return res.status(400).json({ error: "Cannot cancel a completed job" });

    const previousMechanicId = job.mechanicId;

    await prisma.job.update({
      where: { id },
      data: { status: "OPEN", mechanicId: null },
    });

    // Notify the mechanic if there was one
    if (previousMechanicId && job.mechanic) {
      await createAndSendNotification({
        recipientId: previousMechanicId,
        actorId: userId,
        type: "job_update",
        message: `❌ ${job.poster.name} cancelled the job "${job.title}". It's back on the map.`,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("CANCEL JOB ERROR:", err);
    res.status(500).json({ error: "Failed to cancel job" });
  }
};