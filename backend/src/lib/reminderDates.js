// src/lib/reminderDates.js
// Date helpers for maintenance reminders. Due dates are calendar days, so
// they're stored as 12:00 UTC on that day — noon keeps the same calendar date
// in every US timezone, so "due Mar 4" never shows up as Mar 3 or Mar 5.

const DAY_MS = 24 * 60 * 60 * 1000;

// "2026-10-20" or a Date -> Date at 12:00 UTC on that calendar day (or null)
export function toDueDate(input) {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate(), 12));
  }
  if (typeof input !== "string") return null;
  const m = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const date = new Date(Date.UTC(y, mo, d, 12));
  // Reject rollovers like 2026-02-31
  if (date.getUTCMonth() !== mo || date.getUTCDate() !== d) return null;
  return date;
}

// Add whole months, clamping to the end of shorter months (Jan 31 + 1 = Feb 28/29)
export function addMonths(date, months) {
  const y = date.getUTCFullYear();
  const mo = date.getUTCMonth() + months;
  const d = date.getUTCDate();
  const lastDay = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, mo, Math.min(d, lastDay), 12));
}

export function today() {
  return toDueDate(new Date());
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}
