// onboarding-funnel.js — READ ONLY. Answers "where do new users quit?"
//
// Reads OnboardingEvent rows (logged by the app from 1.0.31 on, see
// src/routes/events.routes.js and frontend50/lib/track.ts). One install = one
// phone's copy of the app (random installId), so steps before an account exists
// line up with the account afterwards.
//
// Counts DISTINCT installs that reached each step, then shows, for installs that
// never finished onboarding, the LAST step they reached = where they quit.
// "Finished" is the DB truth: the linked user has hasCompletedOnboarding (DIYer
// saved a vehicle, mechanic submitted verification).
//
// Only NEW installs are counted: ones that logged first_open or register_view,
// or whose account was created inside the window. Existing users who reinstall
// and just log in are listed separately. Installs linked to admin, test, banned
// or Michael's own accounts are dropped.
//
// Usage:  node onboarding-funnel.js        (last 30 days)
//         node onboarding-funnel.js 7      (last 7 days)
// Output: console + reports/onboarding-funnel.txt
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "fs";

const prisma = new PrismaClient();
const TEST_EMAILS = ["test@google.com", "apple@test.com"];
const OWN_PEOPLE = [6, 8, 69, 100]; // Lauren, Arch, Tony, MAZ (same list as signup-quality.js)
const DAY = 24 * 60 * 60 * 1000;
const DAYS = Math.max(1, Number(process.argv[2]) || 30);
const since = new Date(Date.now() - DAYS * DAY);

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : "—");
const lpad = (s, n) => String(s).padStart(n);
const pad = (s, n) => String(s).padEnd(n);
const out = [];
const log = (s = "") => { console.log(s); out.push(s); };

// Shared steps, then the role-specific finish.
const COMMON = [
  ["first_open", "Opened the app (first launch)"],
  ["slides_done", "Got through the intro slides"],
  ["register_view", "Opened Create Account"],
  ["register_submit", "Tapped Sign Up (passed the form checks)"],
  ["register_ok", "Account created, code emailed"],
  ["verify_view", "Saw the code screen"],
  ["verified", "Entered the code (logged in)"],
  ["first_vehicle_view", "Saw the welcome / first-vehicle screen"],
];
const DIYER = [["vehicle_add_view", "Opened Add Vehicle"], ["vehicle_saved", "Saved a vehicle"]];
const MECH = [["verify_form_view", "Opened the verification form"], ["verify_form_submit", "Submitted verification"]];

async function main() {
  const events = await prisma.onboardingEvent.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
  });
  log(`Onboarding funnel — last ${DAYS} days (since ${since.toISOString().slice(0, 10)}) — ${events.length} events`);
  if (!events.length) {
    log("\nNo events yet. They start with app 1.0.31 (and only after `npx prisma db push` + backend deploy).");
    return save();
  }

  // Group by install.
  const installs = new Map();
  for (const e of events) {
    let i = installs.get(e.installId);
    if (!i) installs.set(e.installId, (i = { id: e.installId, steps: new Map(), events: [], userId: null, role: null, platform: e.platform, version: e.appVersion }));
    i.events.push(e);
    if (!i.steps.has(e.step)) i.steps.set(e.step, e);
    if (e.userId) i.userId = e.userId;
    if (e.meta?.role) i.role = e.meta.role;
  }

  const userIds = [...new Set([...installs.values()].map((i) => i.userId).filter(Boolean))];
  const users = new Map(
    (await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true, role: true, isAdmin: true, isBanned: true, createdAt: true, hasCompletedOnboarding: true, emailVerified: true },
    })).map((u) => [u.id, u])
  );

  const fresh = [], returning = [];
  let dropped = 0;
  for (const i of installs.values()) {
    const u = i.userId ? users.get(i.userId) : null;
    if (u && (u.isAdmin || u.isBanned || TEST_EMAILS.includes(u.email) || OWN_PEOPLE.includes(u.id))) { dropped++; continue; }
    i.user = u;
    if (u?.role) i.role = u.role;
    i.done = !!u?.hasCompletedOnboarding;
    const isNew = i.steps.has("first_open") || i.steps.has("register_view") || (u && u.createdAt >= since);
    (isNew ? fresh : returning).push(i);
  }

  log(`\n${fresh.length} new installs · ${returning.length} existing users who opened a logged-out screen · ${dropped} dropped (admin/test/own/banned)`);
  const byPlat = {};
  for (const i of fresh) byPlat[i.platform || "?"] = (byPlat[i.platform || "?"] || 0) + 1;
  log(`Platforms: ${Object.entries(byPlat).map(([k, v]) => `${k} ${v}`).join(" · ")}`);

  // ── Funnel ────────────────────────────────────────────────────────────────
  const reached = (list, step) => list.filter((i) => i.steps.has(step)).length;
  const funnel = (title, list, steps) => {
    log(`\n── ${title} (${list.length} installs) ──`);
    let prev = null;
    for (const [step, label] of steps) {
      const n = reached(list, step);
      const drop = prev != null && prev > 0 ? `  (${pct(n, prev)} of previous)` : "";
      log(`  ${lpad(n, 4)}  ${pad(label, 42)}${drop}`);
      prev = n;
    }
    log(`  ${lpad(list.filter((i) => i.done).length, 4)}  ${pad("Finished onboarding (DB)", 42)}`);
  };
  funnel("Everyone, up to the welcome screen", fresh, COMMON);
  const diy = fresh.filter((i) => i.role !== "MECHANIC");
  const mech = fresh.filter((i) => i.role === "MECHANIC");
  funnel("DIYers (incl. role unknown)", diy, [["verified", "Entered the code (logged in)"], ["first_vehicle_view", "Saw the first-vehicle screen"], ...DIYER]);
  funnel("Mechanics", mech, [["verified", "Entered the code (logged in)"], ["first_vehicle_view", "Saw the welcome screen"], ...MECH]);

  // ── Where they quit ───────────────────────────────────────────────────────
  const order = [...COMMON.map((s) => s[0]), ...DIYER.map((s) => s[0]), ...MECH.map((s) => s[0])];
  const labels = Object.fromEntries([...COMMON, ...DIYER, ...MECH, ["login_view", "Login screen"], ["welcome_view", "Welcome screen"]]);
  const quit = {};
  for (const i of fresh.filter((x) => !x.done)) {
    let last = null;
    for (const s of order) if (i.steps.has(s)) last = s;
    if (!last) last = i.steps.has("login_view") ? "login_view" : i.steps.has("welcome_view") ? "welcome_view" : "(other)";
    quit[last] = (quit[last] || 0) + 1;
  }
  const notDone = fresh.filter((x) => !x.done).length;
  log(`\n── Where unfinished installs stopped (${notDone}) — last step reached ──`);
  for (const [s, n] of Object.entries(quit).sort((a, b) => b[1] - a[1]))
    log(`  ${lpad(n, 4)}  ${pad(labels[s] || s, 42)} ${pct(n, notDone)}`);

  // ── Details ───────────────────────────────────────────────────────────────
  const countMeta = (step, key) => {
    const c = {};
    for (const i of fresh) for (const e of i.events) if (e.step === step) {
      const v = String(e.meta?.[key] ?? "—");
      c[v] = (c[v] || 0) + 1;
    }
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  };
  const section = (title, rows) => {
    if (!rows.length) return;
    log(`\n── ${title} ──`);
    for (const [k, n] of rows) log(`  ${lpad(n, 4)}  ${k}`);
  };

  // After the slides the app lands on Login, not Create Account.
  const afterSlides = fresh.filter((i) => i.steps.has("slides_done"));
  const toRegister = afterSlides.filter((i) => i.steps.has("register_view")).length;
  log(`\n── After the slides (they land on Login) ──`);
  log(`  ${afterSlides.length} finished/skipped the slides → ${toRegister} found Create Account (${pct(toRegister, afterSlides.length)})`);
  section("Slides: skipped vs finished", countMeta("slides_done", "skipped").map(([k, n]) => [k === "true" ? "skipped" : "went through all 5", n]));
  section("Sign Up blocked by the form (taps, not installs)", countMeta("register_blocked", "reason"));
  section("Sign Up refused by the server", countMeta("register_error", "reason"));
  const resend = fresh.filter((i) => i.steps.has("verify_resend")).length;
  const back = fresh.filter((i) => i.steps.has("verify_back")).length;
  log(`\n── Code screen ──`);
  log(`  ${resend} installs tapped Resend · ${back} tapped "Wrong email? Go back"`);
  section("Wrong code / expired (taps)", countMeta("verify_error", "reason"));
  section("Welcome screen buttons (role · action)", (() => {
    const c = {};
    for (const i of fresh) for (const e of i.events) if (e.step === "first_vehicle_tap") {
      const k = `${e.meta?.role || "?"} · ${e.meta?.action || "?"}`;
      c[k] = (c[k] || 0) + 1;
    }
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  })());
  section("Add Vehicle blocked (taps)", countMeta("vehicle_add_blocked", "reason"));
  section("VIN scan result", countMeta("vin_scan", "ok").map(([k, n]) => [k === "true" ? "read a VIN" : "no VIN / error", n]));
  section("Vehicle save errors", fresh.some((i) => i.steps.has("vehicle_add_error")) ? [["save failed", fresh.filter((i) => i.steps.has("vehicle_add_error")).length]] : []);
  section("Verification form blocked (taps)", countMeta("verify_form_blocked", "reason"));
  section("Verification form errors", countMeta("verify_form_error", "reason"));

  // ── Per install (accounts only) ───────────────────────────────────────────
  log(`\n── New installs with an account, unfinished ──`);
  for (const i of fresh.filter((x) => x.user && !x.done)) {
    let last = null;
    for (const s of order) if (i.steps.has(s)) last = s;
    log(`  #${i.user.id} ${i.user.name || "?"} | ${i.role || "?"} | ${i.platform || "?"} ${i.version || ""} | ${i.user.emailVerified ? "✓code" : "✗code"} | last: ${labels[last] || last || "—"}`);
  }
  save();
}

function save() {
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/onboarding-funnel.txt", out.join("\n"));
  console.log("\nSaved → reports/onboarding-funnel.txt");
}

main().catch((e) => console.error(e)).finally(() => prisma.$disconnect());
