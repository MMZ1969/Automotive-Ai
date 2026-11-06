// library-lib.js — shared helpers for the public diagnosis library scripts
// (library-review.js, library-publish.js, build-library-pages.js).
import { createHash } from "crypto";

// MUST match getDiagnosisCacheKey() in src/server.js, so backfilled rows land
// on the same queryKey the live cache uses.
export function cacheKeyFor(query, vehicle) {
  const vehicleKey = vehicle
    ? `${vehicle.year}-${vehicle.make}-${vehicle.model}-${vehicle.trim || ""}-${vehicle.engine || ""}`
    : "no-vehicle";
  return `${vehicleKey}::${String(query).trim().toLowerCase()}`;
}
export const hashKey = (k) => createHash("sha256").update(k).digest("hex");

// "Ford" -> "ford", "F-150 Styleside" -> "f-150-styleside", "Grand Caravan" -> "grand-caravan"
export function slugify(s, max = 60) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

// Title-case a make/model for display when the user typed it lowercase/uppercase
// ("FORD" -> "Ford", "nissan" -> "Nissan"); keeps short all-caps like "BMW", "GMC".
export function displayName(s) {
  const t = String(s || "").trim();
  if (!t) return t;
  return t.split(/\s+/).map((w) => {
    if (/\d/.test(w)) return w.includes("-") ? w.toUpperCase() : w; // f-150 -> F-150, cx-5 -> CX-5, 535i stays
    if (/^[A-Z]{2,3}$/.test(w)) return w;                            // BMW, GMC, VW stay
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();     // FORD/ford -> Ford
  }).join(" ");
}

// Diagnosis steps have been plain strings, and in older answers {step, detail} objects.
export function stepText(st) {
  if (typeof st === "string") return st;
  if (!st || typeof st !== "object") return "";
  const main = st.step || st.title || st.instruction || st.text || "";
  return st.detail ? `${main} — ${st.detail}` : main;
}
