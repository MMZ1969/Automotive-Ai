// src/lib/authToken.js
// One place that mints login tokens.
//
// Tokens used to expire after 7 days with no renewal, so anyone who didn't
// open the app for a week was silently logged out ("it logged me out after
// an update"). Now: 90-day tokens, plus authMiddleware hands back a fresh
// one (X-Refreshed-Token header) on any request made with a token older
// than REFRESH_AFTER_SECONDS. App builds that read the header stay logged
// in indefinitely as long as they're opened at least once every 90 days;
// older builds simply ignore the header and still get the 90-day tokens.
import jwt from "jsonwebtoken";

export const TOKEN_TTL = "90d";
export const REFRESH_AFTER_SECONDS = 24 * 60 * 60; // re-issue at most once a day

export function signToken({ id, role }) {
  return jwt.sign({ userId: id, role }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}
