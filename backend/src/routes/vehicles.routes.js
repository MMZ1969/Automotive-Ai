// src/routes/vehicles.routes.js
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import * as vehiclesController from "../controllers/vehicles.controllers.js";

const router = express.Router();

router.get("/", authMiddleware, vehiclesController.getMyVehicles);
router.post("/", authMiddleware, vehiclesController.createVehicle);
router.get("/:id", authMiddleware, vehiclesController.getVehicleById);
router.put("/:id", authMiddleware, vehiclesController.updateVehicle);
router.delete("/:id", authMiddleware, vehiclesController.deleteVehicle);

export default router;