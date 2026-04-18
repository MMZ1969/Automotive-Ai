// src/routes/logs.routes.js
console.log("🔥 LOG ROUTES LOADED");
import express from "express";
import {
  getAllLogs,
  getLogsForVehicle,
  createLog,
  getLogById,
  updateLog,
  deleteLog,
} from "../controllers/logs.controller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// All log routes require authentication
router.use(authMiddleware);

// GET all logs for the authenticated user
router.get("/", getAllLogs);

// GET logs for a specific vehicle
router.get("/vehicle/:vehicleId", getLogsForVehicle);

// CREATE a log for a vehicle
router.post("/vehicle/:vehicleId", createLog);

// GET a single log
router.get("/vehicle/:vehicleId/:logId", getLogById);

// UPDATE a log
router.put("/vehicle/:vehicleId/:logId", updateLog);

// DELETE a log
router.delete("/vehicle/:vehicleId/:logId", deleteLog);

export default router;