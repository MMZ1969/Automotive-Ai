// src/controllers/vehicles.controllers.js
import prisma from "../lib/prisma.js";

// Create a vehicle
export const createVehicle = async (req, res) => {
  try {
    const userId = req.user.id;
    const { year, make, model, trim, vin } = req.body;

    const vehicle = await prisma.vehicle.create({
      data: {
        userId,
        year,
        make,
        model,
        trim,
        vin,
      },
    });

    res.json(vehicle);
  } catch (err) {
    console.error("CREATE VEHICLE ERROR:", err);
    res.status(500).json({ message: "Failed to create vehicle" });
  }
};

// Get vehicles for logged-in user
export const getMyVehicles = async (req, res) => {
  try {
    const userId = req.user.id;

    const vehicles = await prisma.vehicle.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    res.json(vehicles);
  } catch (err) {
    console.error("GET VEHICLES ERROR:", err);
    res.status(500).json({ message: "Failed to fetch vehicles" });
  }
};

// ⭐ Get a single vehicle by ID
export const getVehicleById = async (req, res) => {
  try {
    const userId = req.user.id;
    const vehicleId = Number(req.params.id);

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle || vehicle.userId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    res.json(vehicle);
  } catch (err) {
    console.error("GET VEHICLE ERROR:", err);
    res.status(500).json({ message: "Failed to fetch vehicle" });
  }
};

// Update a vehicle
export const updateVehicle = async (req, res) => {
  try {
    const userId = req.user.id;
    const vehicleId = Number(req.params.id);
    const { year, make, model, trim, vin } = req.body;

    const existing = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!existing || existing.userId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { year, make, model, trim, vin },
    });

    res.json(updated);
  } catch (err) {
    console.error("UPDATE VEHICLE ERROR:", err);
    res.status(500).json({ message: "Failed to update vehicle" });
  }
};

// Delete a vehicle
export const deleteVehicle = async (req, res) => {
  try {
    const userId = req.user.id;
    const vehicleId = Number(req.params.id);

    const existing = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!existing || existing.userId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Delete related logs first to avoid constraint errors
    await prisma.log.deleteMany({
      where: { vehicleId },
    });

    await prisma.vehicle.delete({
      where: { id: vehicleId },
    });

    res.json({ message: "Vehicle deleted" });
  } catch (err) {
    console.error("DELETE VEHICLE ERROR:", err);
    res.status(500).json({ message: "Failed to delete vehicle" });
  }
};