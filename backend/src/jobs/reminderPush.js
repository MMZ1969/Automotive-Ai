// src/jobs/reminderPush.js
// Daily maintenance-reminder pushes.
//
// Each reminder gets at most two pushes per due date:
//   1. on the due day                ("Oil change is due on your 2015 Outlander")
//   2. 7 days later if still not done ("Reminder: oil change was due last week ...")
// Marking it done (or changing the date) clears both stamps for the next cycle.
//
// Runs inside the API process: a 15-minute timer that only does work once
// per UTC day after SEND_HOUR_UTC (~11am Eastern). Every send first "claims"
// the reminder with a conditional update on its stamp, so restarts, redeploys
// or a second instance can never double-send.
import prisma from "../lib/prisma.js";
import { sendPushNotification } from "../controllers/notification.controller.js";
import { addDays } from "../lib/reminderDates.js";

const SEND_HOUR_UTC = 15; // 11am EDT / 10am EST
const FOLLOWUP_DAYS = 7;
const CHECK_EVERY_MS = 15 * 60 * 1000;
// Follow-up needs the first push to be ~a week old (1h slack for run-time drift).
const FOLLOWUP_GAP_MS = FOLLOWUP_DAYS * 24 * 60 * 60 * 1000 - 60 * 60 * 1000;

function vehicleName(v) {
  return [v.year, v.make, v.model].filter(Boolean).join(" ");
}

const REMINDER_INCLUDE = {
  vehicle: { select: { id: true, year: true, make: true, model: true } },
  user: { select: { pushToken: true, isBanned: true } },
};

async function claimAndSend(reminder, stampField, title, body) {
  // Claim first: only one run can flip the stamp from null.
  const claimed = await prisma.reminder.updateMany({
    where: { id: reminder.id, [stampField]: null },
    data: { [stampField]: new Date() },
  });
  if (claimed.count !== 1) return false;
  if (!reminder.user?.pushToken || reminder.user.isBanned) return false;

  await sendPushNotification(reminder.user.pushToken, title, body, null, {
    type: "REMINDER",
    reminderId: reminder.id,
    vehicleId: reminder.vehicleId,
  });
  return true;
}

export async function runReminderPushes(now = new Date()) {
  let sent = 0;

  const due = await prisma.reminder.findMany({
    where: { dueAt: { lte: now }, notifiedDueAt: null },
    include: REMINDER_INCLUDE,
    take: 500,
  });
  for (const r of due) {
    const ok = await claimAndSend(
      r,
      "notifiedDueAt",
      "🔧 Maintenance due",
      `${r.title} is due on your ${vehicleName(r.vehicle)}. Tap to mark it done.`
    );
    if (ok) sent++;
  }

  const overdue = await prisma.reminder.findMany({
    where: {
      dueAt: { lte: addDays(now, -FOLLOWUP_DAYS) },
      notifiedDueAt: { not: null },
      notifiedFollowupAt: null,
    },
    include: REMINDER_INCLUDE,
    take: 500,
  });
  for (const r of overdue) {
    // A reminder created already a week+ overdue just got its first push in
    // the loop above; don't hit it with the follow-up in the same run.
    if (now.getTime() - r.notifiedDueAt.getTime() < FOLLOWUP_GAP_MS) continue;
    const ok = await claimAndSend(
      r,
      "notifiedFollowupAt",
      "🔧 Still on your list?",
      `${r.title} was due last week on your ${vehicleName(r.vehicle)}. Done it? Tap to check it off.`
    );
    if (ok) sent++;
  }

  return { due: due.length, overdue: overdue.length, sent };
}

let lastRunDay = null;
let running = false;

async function tick() {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  if (running || lastRunDay === day || now.getUTCHours() < SEND_HOUR_UTC) return;
  running = true;
  try {
    const result = await runReminderPushes(now);
    lastRunDay = day;
    console.log(`REMINDER PUSHES ${day}:`, result);
  } catch (err) {
    console.error("REMINDER PUSH JOB ERROR:", err);
  } finally {
    running = false;
  }
}

export function startReminderScheduler() {
  setTimeout(tick, 60 * 1000); // once shortly after boot (catch-up after a redeploy)
  setInterval(tick, CHECK_EVERY_MS);
  console.log("⏰ Reminder scheduler started");
}

