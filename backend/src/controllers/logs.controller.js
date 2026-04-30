// src/controllers/logs.controller.js
import prisma from "../lib/prisma.js";

// GET all logs for the authenticated user
export const getAllLogs = async (req, res) => {
  try {
    const userId = req.user.id;

    const logs = await prisma.log.findMany({
      where: { userId },
      orderBy: { performedAt: "desc" },
    });

    res.json(logs);
  } catch (err) {
    console.error("GET ALL LOGS ERROR:", err);
    res.status(500).json({ message: "Failed to fetch logs" });
  }
};

// GET logs for a specific vehicle
export const getLogsForVehicle = async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.vehicleId);
    const userId = req.user.id;

    const logs = await prisma.log.findMany({
      where: { vehicleId, userId },
      orderBy: { performedAt: "desc" },
    });

    res.json(logs);
  } catch (err) {
    console.error("GET LOGS ERROR:", err);
    res.status(500).json({ message: "Failed to fetch logs" });
  }
};

// CREATE a log
export const createLog = async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.vehicleId);
    const userId = req.user.id;

    const { title, description, mileage, cost, performedAt, category } = req.body;

const log = await prisma.log.create({
  data: {
    title,
    description: description || null,
    mileage: mileage ? parseInt(mileage) : null,
    cost: cost ? parseFloat(cost) : null,
    category: category || null,
    performedAt: performedAt ? new Date(performedAt) : null,
    vehicle: { connect: { id: vehicleId } },
    user: { connect: { id: userId } },
  },
});

    res.json(log);
  } catch (err) {
    console.error("CREATE LOG ERROR:", err);
    res.status(500).json({ message: "Failed to create log" });
  }
};

// GET single log
export const getLogById = async (req, res) => {
  try {
    console.log("GET LOG BY ID PARAMS:", req.params);
    
    const vehicleId = parseInt(req.params.vehicleId);
    const logId = parseInt(req.params.logId);

    console.log("parsed vehicleId:", vehicleId, "logId:", logId);

    if (!logId || isNaN(logId)) {
      return res.status(400).json({ message: "Invalid log ID" });
    }

    if (!vehicleId || isNaN(vehicleId)) {
      return res.status(400).json({ message: "Invalid vehicle ID" });
    }

    const userId = req.user.id;
    console.log("userId from token:", userId); // ← ADD THIS

    const log = await prisma.log.findUnique({
      where: { id: logId },
    });

    console.log("log found:", log); // ← AND THIS

    if (!log || log.vehicleId !== vehicleId || log.userId !== userId) {
      return res.status(404).json({ message: "Log not found" });
    }

    res.json(log);
  } catch (err) {
    console.error("GET LOG ERROR:", err);
    res.status(500).json({ message: "Failed to fetch log" });
  }
};

// UPDATE log
export const updateLog = async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.vehicleId);
    const logId = parseInt(req.params.logId);
    const userId = req.user.id;

    const { title, description, mileage, cost, performedAt } = req.body;

    const existing = await prisma.log.findUnique({
      where: { id: logId },
    });

    if (!existing || existing.vehicleId !== vehicleId || existing.userId !== userId) {
      return res.status(404).json({ message: "Log not found" });
    }

    const updated = await prisma.log.update({
      where: { id: logId },
      data: {
        title,
        description,
        mileage,
        cost,
        performedAt: performedAt ? new Date(performedAt) : existing.performedAt,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("UPDATE LOG ERROR:", err);
    res.status(500).json({ message: "Failed to update log" });
  }
};

// DELETE log
export const deleteLog = async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.vehicleId);
    const logId = parseInt(req.params.logId);
    const userId = req.user.id;

    const existing = await prisma.log.findUnique({
      where: { id: logId },
    });

    if (!existing || existing.vehicleId !== vehicleId || existing.userId !== userId) {
      return res.status(404).json({ message: "Log not found" });
    }

    await prisma.log.delete({
      where: { id: logId },
    });

    res.json({ message: "Log deleted" });
  } catch (err) {
    console.error("DELETE LOG ERROR:", err);
    res.status(500).json({ message: "Failed to delete log" });
  }
};