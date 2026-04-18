const express = require("express");
const router = express.Router();
const prisma = require("../prisma");
const auth = require("../middleware/auth");

// GET logs for a specific vehicle
router.get("/vehicle/:vehicleId", auth, async (req, res) => {
  const { vehicleId } = req.params;

  const logs = await prisma.log.findMany({
    where: {
      vehicleId,
      vehicle: { userId: req.user.id },
    },
    orderBy: { date: "desc" },
  });

  res.json(logs);
});

// CREATE log for a specific vehicle
router.post("/vehicle/:vehicleId", auth, async (req, res) => {
  const { vehicleId } = req.params;
  const {
    date,
    mileage,
    category,
    subcategory,
    cost,
    laborHours,
    parts,
    notes,
  } = req.body;

  const log = await prisma.log.create({
    data: {
      vehicleId,
      date: new Date(date),
      mileage,
      category,
      subcategory,
      cost,
      laborHours,
      parts,
      notes,
    },
  });

  res.json(log);
});

// GLOBAL: GET logs (optional filter by vehicle)
router.get("/", auth, async (req, res) => {
  const { vehicleId } = req.query;

  const logs = await prisma.log.findMany({
    where: {
      vehicle: { userId: req.user.id },
      ...(vehicleId ? { vehicleId } : {}),
    },
    orderBy: { date: "desc" },
  });

  res.json(logs);
});

// GLOBAL: GET single log
router.get("/:logId", auth, async (req, res) => {
  const log = await prisma.log.findFirst({
    where: {
      id: req.params.logId,
      vehicle: { userId: req.user.id },
    },
  });

  if (!log) return res.status(404).json({ error: "Not found" });

  res.json(log);
});

// UPDATE log
router.put("/:logId", auth, async (req, res) => {
  const {
    date,
    mileage,
    category,
    subcategory,
    cost,
    laborHours,
    parts,
    notes,
  } = req.body;

  const updated = await prisma.log.update({
    where: { id: req.params.logId },
    data: {
      date: new Date(date),
      mileage,
      category,
      subcategory,
      cost,
      laborHours,
      parts,
      notes,
    },
  });

  res.json(updated);
});

// DELETE log
router.delete("/:logId", auth, async (req, res) => {
  await prisma.log.delete({
    where: { id: req.params.logId },
  });

  res.json({ success: true });
});

module.exports = router;