import api from "@lib/api";

export type Reminder = {
  id: number;
  vehicleId: number;
  title: string;
  intervalMonths: number | null;
  dueAt: string;
  lastDoneAt: string | null;
  vehicle?: { id: number; year: number; make: string; model: string };
};

// Common jobs and how often most owners do them. Used for the "+ Add
// reminder" presets and to pre-select an interval after logging a job.
export const REMINDER_PRESETS: { title: string; months: number; match: RegExp }[] = [
  { title: "Oil change", months: 6, match: /\boil\b/i },
  { title: "Tire rotation", months: 6, match: /rotat/i },
  { title: "Engine air filter", months: 12, match: /air filter|engine filter/i },
  { title: "Cabin air filter", months: 12, match: /cabin/i },
  { title: "Wiper blades", months: 12, match: /wiper/i },
  { title: "Registration / inspection", months: 12, match: /registr|inspect|emission|smog/i },
  { title: "Brake fluid", months: 24, match: /brake fluid/i },
  { title: "Coolant flush", months: 24, match: /coolant|antifreeze/i },
];

export function suggestedMonths(title: string): number {
  return REMINDER_PRESETS.find((p) => p.match.test(title))?.months ?? 6;
}

// "YYYY-MM-DD" (local calendar day) + n months, clamped to month end.
export function addMonthsToDay(day: string, months: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, last));
  return toDay(target);
}

export function toDay(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function todayDay(): string {
  return toDay(new Date());
}

// Due dates are stored as noon UTC on the calendar day, so read them as UTC.
function dueDay(dueAt: string): string {
  return new Date(dueAt).toISOString().slice(0, 10);
}

export function daysUntil(dueAt: string): number {
  const [y, m, d] = dueDay(dueAt).split("-").map(Number);
  const due = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((due - today) / 86400000);
}

export function formatDue(dueAt: string): { text: string; tone: "overdue" | "soon" | "later" } {
  const n = daysUntil(dueAt);
  if (n < 0) return { text: `Overdue by ${-n} day${n === -1 ? "" : "s"}`, tone: "overdue" };
  if (n === 0) return { text: "Due today", tone: "overdue" };
  if (n <= 14) return { text: `Due in ${n} day${n === 1 ? "" : "s"}`, tone: "soon" };
  const [y, m, d] = dueDay(dueAt).split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return {
    text: `Due ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) })}`,
    tone: "later",
  };
}

export function repeatLabel(months: number | null): string {
  if (!months) return "One-time";
  if (months % 12 === 0) return months === 12 ? "Every year" : `Every ${months / 12} years`;
  return months === 1 ? "Every month" : `Every ${months} months`;
}

export async function fetchReminders(vehicleId?: number | string): Promise<Reminder[]> {
  const res = await api.get(vehicleId ? `/api/reminders?vehicleId=${vehicleId}` : "/api/reminders");
  return res.data;
}

export async function createReminder(body: {
  vehicleId: number | string;
  title: string;
  intervalMonths?: number | null;
  dueAt?: string;
}): Promise<Reminder> {
  const res = await api.post("/api/reminders", { ...body, vehicleId: Number(body.vehicleId) });
  return res.data;
}

export async function completeReminder(id: number): Promise<{ deleted: boolean; reminder?: Reminder }> {
  const res = await api.post(`/api/reminders/${id}/done`);
  return res.data;
}

export async function deleteReminder(id: number): Promise<void> {
  await api.delete(`/api/reminders/${id}`);
}
