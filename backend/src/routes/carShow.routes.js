import express from "express";
import prisma from "../lib/prisma.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// GET all upcoming car shows
router.get("/", authMiddleware, async (req, res) => {
  try {
    const shows = await prisma.carShow.findMany({
      where: {
        date: { gte: new Date() },
      },
      orderBy: { date: "asc" },
      include: {
        user: {
          select: { id: true, name: true, profilePhoto: true, role: true, isVerified: true },
        },
        attendees: {
          select: { userId: true },
        },
      },
    });
    res.json(shows);
  } catch (err) {
    console.error("GET CAR SHOWS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch car shows" });
  }
});

// GET single car show
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const show = await prisma.carShow.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: {
          select: { id: true, name: true, profilePhoto: true, role: true, isVerified: true },
        },
        attendees: {
          select: { userId: true },
        },
      },
    });
    if (!show) return res.status(404).json({ error: "Car show not found" });
    res.json(show);
  } catch (err) {
    console.error("GET CAR SHOW ERROR:", err);
    res.status(500).json({ error: "Failed to fetch car show" });
  }
});

// POST create a car show
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, description, location, date, imageUrl } = req.body;
    if (!name || !location || !date) {
      return res.status(400).json({ error: "Name, location, and date are required" });
    }
    const show = await prisma.carShow.create({
      data: {
        userId: req.user.id,
        name,
        description,
        location,
        date: new Date(date),
        imageUrl,
      },
      include: {
        user: {
          select: { id: true, name: true, profilePhoto: true, role: true, isVerified: true },
        },
        attendees: {
          select: { userId: true },
        },
      },
    });

    // Award +10 rep for posting a car show
    await prisma.user.update({
      where: { id: req.user.id },
      data: { repPoints: { increment: 10 } },
    });

    res.status(201).json(show);
  } catch (err) {
    console.error("CREATE CAR SHOW ERROR:", err);
    res.status(500).json({ error: "Failed to create car show" });
  }
});

// POST toggle attendance (I'm Going / Not Going)
router.post("/:id/attend", authMiddleware, async (req, res) => {
  try {
    const carShowId = parseInt(req.params.id);
    const userId = req.user.id;

    const existing = await prisma.carShowAttendee.findUnique({
      where: { carShowId_userId: { carShowId, userId } },
    });

    if (existing) {
      await prisma.carShowAttendee.delete({
        where: { carShowId_userId: { carShowId, userId } },
      });
      return res.json({ attending: false });
    } else {
      await prisma.carShowAttendee.create({
        data: { carShowId, userId },
      });

      // Notify the show organizer
      try {
        const show = await prisma.carShow.findUnique({
          where: { id: carShowId },
          select: { userId: true, name: true },
        });
        const attendee = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });
        if (show && show.userId !== userId) {
          const { createAndSendNotification } = await import("../controllers/notification.controller.js");
          await createAndSendNotification({
            recipientId: show.userId,
            actorId: userId,
            type: "car_show",
            message: `🚗 ${attendee?.name || "Someone"} is going to your car show: "${show.name}"!`,
          });
        }
      } catch (notifErr) {
        console.error("CAR SHOW NOTIFY ERROR:", notifErr);
      }

      return res.json({ attending: true });
    }
  } catch (err) {
    console.error("ATTEND CAR SHOW ERROR:", err);
    res.status(500).json({ error: "Failed to update attendance" });
  }
});

// DELETE car show (owner only)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const show = await prisma.carShow.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!show) return res.status(404).json({ error: "Car show not found" });
    if (show.userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }
    await prisma.carShowAttendee.deleteMany({ where: { carShowId: show.id } });
    await prisma.carShow.delete({ where: { id: show.id } });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE CAR SHOW ERROR:", err);
    res.status(500).json({ error: "Failed to delete car show" });
  }
});

export default router;