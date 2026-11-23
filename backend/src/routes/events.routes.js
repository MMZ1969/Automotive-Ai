// POST /api/events — onboarding step logging (see OnboardingEvent in schema.prisma).
//
// Works before login: the app sends a random installId, plus its Bearer token
// once it has one (then userId is filled in). Never returns 401, because the
// app's api.ts logs the user out on any 401. Unknown steps and bad input are
// ignored with a 204, so a broken client never sees an error. The write is
// fire-and-forget after the response.
import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

const router = express.Router();

// Keep in sync with lib/track.ts in the app.
export const ONBOARDING_STEPS = new Set([
  "first_open",          // first launch on this install (intro slides not seen yet)
  "slides_done",         // meta { slide, skipped }
  "welcome_view",
  "login_view",
  "register_view",
  "register_blocked",    // client-side check stopped Sign Up; meta { reason }
  "register_submit",     // meta { role }
  "register_ok",         // account created, code sent; meta { role }
  "register_error",      // server refused; meta { reason }
  "verify_view",
  "verify_resend",
  "verify_back",         // "Wrong email? Go back"
  "verify_error",        // meta { reason }
  "verified",            // code accepted, logged in
  "first_vehicle_view",  // meta { role }
  "first_vehicle_tap",   // meta { role, action }
  "vehicle_add_view",    // meta { first }
  "vehicle_add_blocked", // meta { reason }
  "vehicle_saved",       // meta { first, vin }
  "vehicle_add_error",
  "vin_scan",            // meta { ok }
  "verify_form_view",    // mechanic verification form
  "verify_form_blocked", // meta { reason }
  "verify_form_submit",
  "verify_form_error",
]);

const limiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: "slow down" } });

function userIdFrom(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  try {
    const decoded = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    const id = Number(decoded?.userId);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null; // expired/bad token: still log the step, just without a user
  }
}

function cleanMeta(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return undefined;
  const out = {};
  for (const [k, v] of Object.entries(meta).slice(0, 6)) {
    if (!/^[a-zA-Z]{1,20}$/.test(k)) continue;
    if (typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 100);
  }
  return Object.keys(out).length ? out : undefined;
}

router.post("/", limiter, (req, res) => {
  res.status(204).end();

  const { installId, step, meta, platform, appVersion } = req.body || {};
  if (typeof installId !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(installId)) return;
  if (typeof step !== "string" || !ONBOARDING_STEPS.has(step)) return;

  prisma.onboardingEvent
    .create({
      data: {
        installId,
        step,
        userId: userIdFrom(req),
        meta: cleanMeta(meta),
        platform: typeof platform === "string" ? platform.slice(0, 10) : null,
        appVersion: typeof appVersion === "string" ? appVersion.slice(0, 20) : null,
      },
    })
    .catch((err) => {
      // P2003 = userId points at a deleted user; log without it.
      if (err?.code === "P2003") {
        return prisma.onboardingEvent
          .create({ data: { installId, step, meta: cleanMeta(meta) } })
          .catch(() => {});
      }
      console.error("ONBOARDING EVENT ERROR:", err?.message || err);
    });
});

export default router;
