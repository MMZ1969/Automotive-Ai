// src/controllers/vehicles.controllers.js
import prisma from "../lib/prisma.js";

// Helper — decode VIN via NHTSA and return engine details
const decodeVin = async (vin) => {
  try {
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`);
    const data = await res.json();
    const results = data.Results;

    const get = (variable) => {
      const found = results.find((r) => r.Variable === variable);
      return found?.Value && found.Value !== "Not Applicable" && found.Value !== "null" ? found.Value : null;
    };

    const cylinders = get("Engine Number of Cylinders");
    const displacement = get("Displacement (L)");
    const driveType = get("Drive Type");
    const trim = get("Trim");

    // Build a human readable engine string e.g. "2.4L 4-Cylinder"
    let engine = null;
    if (displacement || cylinders) {
      engine = [
        displacement ? `${parseFloat(displacement).toFixed(1)}L` : null,
        cylinders ? `${cylinders}-Cylinder` : null,
      ].filter(Boolean).join(" ");
    }

    return { engine, engineCylinders: cylinders, displacement, driveType, trim };
  } catch (err) {
    console.error("VIN DECODE ERROR:", err);
    return {};
  }
};

// Create a vehicle
export const createVehicle = async (req, res) => {
  try {
    const userId = req.user.id;
    const { year, make, model, trim, vin, mileage, notes } = req.body;

    // Decode VIN if provided
    let vinData = {};
    if (vin && vin.length === 17) {
      vinData = await decodeVin(vin);
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        userId,
        year,
        make,
        model,
        trim: vinData.trim || trim || null,
        vin: vin || null,
        engine: vinData.engine || null,
        engineCylinders: vinData.engineCylinders || null,
        displacement: vinData.displacement || null,
        driveType: vinData.driveType || null,
        mileage: mileage || null,
        notes: notes || null,
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

// Get a single vehicle by ID
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
    const { year, make, model, trim, vin, mileage, notes } = req.body;

    const existing = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!existing || existing.userId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Re-decode VIN if it changed
    let vinData = {};
    if (vin && vin.length === 17 && vin !== existing.vin) {
      vinData = await decodeVin(vin);
    }

    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        year,
        make,
        model,
        trim: vinData.trim || trim || existing.trim,
        vin: vin || existing.vin,
        engine: vinData.engine || existing.engine,
        engineCylinders: vinData.engineCylinders || existing.engineCylinders,
        displacement: vinData.displacement || existing.displacement,
        driveType: vinData.driveType || existing.driveType,
        mileage: mileage || existing.mileage,
        notes: notes || existing.notes,
      },
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

    await prisma.log.deleteMany({ where: { vehicleId } });
    await prisma.vehicle.delete({ where: { id: vehicleId } });

    res.json({ message: "Vehicle deleted" });
  } catch (err) {
    console.error("DELETE VEHICLE ERROR:", err);
    res.status(500).json({ message: "Failed to delete vehicle" });
  }
};