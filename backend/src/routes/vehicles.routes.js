import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import {
  getMyVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from "../controllers/vehicles.controllers.js";

const router = express.Router();

// Get all vehicles for logged-in user
router.get("/", authenticateToken, getMyVehicles);

// Create a vehicle
router.post("/", authenticateToken, createVehicle);

// Update a vehicle
router.put("/:id", authenticateToken, updateVehicle);

// Delete a vehicle
router.delete("/:id", authenticateToken, deleteVehicle);

export default router;