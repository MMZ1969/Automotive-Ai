// src/controllers/reminders.controller.js
// Date-based maintenance reminders, one push on the due day and one
// follow-up a week later if not marked done (see src/jobs/reminderPush.js).
import prisma from "../lib/prisma.js";
import { addMonths, toDueDate, today } from "../lib/reminderDates.js";

const MAX_REMINDERS_PER_USER = 50;
const MAX_TITLE = 60;

const VEHICLE_SELECT = { id: true, year: true, make: true, model: true };

function parseInterval(raw) {
  if (raw === undefined) return undefined; // not sent
  if (raw === null || raw === "" || raw === 0) return null; // one-time
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 60 ? n : NaN;
}

function validDueRange(date) {
  const t = today().getTime();
  const yearMs = 365 * 24 * 60 * 60 * 1000;
  return date.getTime() >= t - yearMs && date.getTime() <= t + 10 * yearMs;
}

async function ownReminder(req, res) {
  const id = Number(req.params.id);
  const reminder = Number.isInteger(id) ? await prisma.reminder.findUnique({ where: { id } }) : null;
  if (!reminder || reminder.userId !== req.user.id) {
    res.status(404).json({ message: "Reminder not found" });
    return null;
  }
  return reminder;
}

// GET /api/reminders?vehicleId=12 — the user's reminders, soonest first
export async function listReminders(req, res) {
  try {
    const vehicleId = req.query.vehicleId ? Number(req.query.vehicleId) : undefined;
    const reminders = await prisma.reminder.findMany({
      where: { userId: req.user.id, ...(Number.isInteger(vehicleId) ? { vehicleId } : {}) },
      orderBy: { dueAt: "asc" },
      include: { vehicle: { select: VEHICLE_SELECT } },
    });
    res.json(reminders);
  } catch (err) {
    console.error("LIST REMINDERS ERROR:", err);
    res.status(500).json({ message: "Failed to load reminders" });
  }
}

// POST /api/reminders  { vehicleId, title, intervalMonths?, dueAt? "YYYY-MM-DD" }
// dueAt defaults to today + intervalMonths. Needs at least one of the two.
export async function createReminder(req, res) {
  try {
    const vehicleId = Number(req.body.vehicleId);
    const title = String(req.body.title || "").trim().slice(0, MAX_TITLE);
    const intervalMonths = parseInterval(req.body.intervalMonths);

    if (!title) return res.status(400).json({ message: "Give the reminder a name." });
    if (Number.isNaN(intervalMonths)) return res.status(400).json({ message: "Repeat interval must be 1–60 months." });

    const vehicle = Number.isInteger(vehicleId)
      ? await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { userId: true } })
      : null;
    if (!vehicle || vehicle.userId !== req.user.id) return res.status(404).json({ message: "Vehicle not found" });

    let dueAt = req.body.dueAt ? toDueDate(req.body.dueAt) : null;
    if (req.body.dueAt && !dueAt) return res.status(400).json({ message: "Invalid due date." });
    if (!dueAt) {
      if (!intervalMonths) return res.status(400).json({ message: "Pick a due date or a repeat interval." });
      dueAt = addMonths(today(), intervalMonths);
    }
    if (!validDueRange(dueAt)) return res.status(400).json({ message: "Due date is out of range." });

    const count = await prisma.reminder.count({ where: { userId: req.user.id } });
    if (count >= MAX_REMINDERS_PER_USER) {
      return res.status(400).json({ message: `You can have up to ${MAX_REMINDERS_PER_USER} reminders.` });
    }

    const reminder = await prisma.reminder.create({
      data: { userId: req.user.id, vehicleId, title, intervalMonths: intervalMonths ?? null, dueAt },
      include: { vehicle: { select: VEHICLE_SELECT } },
    });
    res.status(201).json(reminder);
  } catch (err) {
    console.error("CREATE REMINDER ERROR:", err);
    res.status(500).json({ message: "Failed to create reminder" });
  }
}

// PUT /api/reminders/:id  { title?, intervalMonths?, dueAt? }
export async function updateReminder(req, res) {
  try {
    const existing = await ownReminder(req, res);
    if (!existing) return;

    const data = {};
    if (req.body.title !== undefined) {
      const title = String(req.body.title || "").trim().slice(0, MAX_TITLE);
      if (!title) return res.status(400).json({ message: "Give the reminder a name." });
      data.title = title;
    }
    const intervalMonths = parseInterval(req.body.intervalMonths);
    if (Number.isNaN(intervalMonths)) return res.status(400).json({ message: "Repeat interval must be 1–60 months." });
    if (intervalMonths !== undefined) data.intervalMonths = intervalMonths;

    if (req.body.dueAt !== undefined) {
      const dueAt = toDueDate(req.body.dueAt);
      if (!dueAt || !validDueRange(dueAt)) return res.status(400).json({ message: "Invalid due date." });
      if (dueAt.getTime() !== existing.dueAt.getTime()) {
        Object.assign(data, { dueAt, notifiedDueAt: null, notifiedFollowupAt: null });
      }
    }

    const reminder = await prisma.reminder.update({
      where: { id: existing.id },
      data,
      include: { vehicle: { select: VEHICLE_SELECT } },
    });
    res.json(reminder);
  } catch (err) {
    console.error("UPDATE REMINDER ERROR:", err);
    res.status(500).json({ message: "Failed to update reminder" });
  }
}

// POST /api/reminders/:id/done — repeating: roll forward from today.
// One-time: delete it. Returns { deleted } or { reminder }.
export async function completeReminder(req, res) {
  try {
    const existing = await ownReminder(req, res);
    if (!existing) return;

    if (!existing.intervalMonths) {
      await prisma.reminder.delete({ where: { id: existing.id } });
      return res.json({ deleted: true });
    }

    const reminder = await prisma.reminder.update({
      where: { id: existing.id },
      data: {
        lastDoneAt: new Date(),
        dueAt: addMonths(today(), existing.intervalMonths),
        notifiedDueAt: null,
        notifiedFollowupAt: null,
      },
      include: { vehicle: { select: VEHICLE_SELECT } },
    });
    res.json({ deleted: false, reminder });
  } catch (err) {
    console.error("COMPLETE REMINDER ERROR:", err);
    res.status(500).json({ message: "Failed to update reminder" });
  }
}

// DELETE /api/reminders/:id
export async function deleteReminder(req, res) {
  try {
    const existing = await ownReminder(req, res);
    if (!existing) return;
    await prisma.reminder.delete({ where: { id: existing.id } });
    res.json({ deleted: true });
  } catch (err) {
    console.error("DELETE REMINDER ERROR:", err);
    res.status(500).json({ message: "Failed to delete reminder" });
  }
}
