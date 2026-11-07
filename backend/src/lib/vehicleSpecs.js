// vehicleSpecs.js — verified-spec lookup shared by src/server.js and the
// backend scripts (vehicle-specs.js, diagnosis-eval.js).

// "Ford" -> "ford", "F-150 Styleside" -> "f-150-styleside"
export function slugKey(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// "2.4L I4 Tigershark" -> "2.4", "3.0L V6" -> "3.0", "5.7" -> "5.7", "3L" -> "3.0"
export function displacementKey(s) {
  // "2.4" / "2.4L" anywhere, or a whole number only when followed by L ("3L").
  // Never the 8 in "V8" or the 3 in "3V".
  const t = String(s || "");
  const dec = /(?<![A-Za-z\d.])(\d{1,2}\.\d)(?!\d)/.exec(t);
  if (dec) return dec[1];
  const whole = /(?<![A-Za-z\d.])(\d{1,2})\s*L\b/i.exec(t);
  return whole ? `${whole[1]}.0` : "";
}

// Model match tolerates VIN-decoded extras: spec "f-150" matches vehicle
// "f-150-styleside"; "f150" matches "f-150".
function modelMatches(specModelKey, vehicleModel) {
  const v = slugKey(vehicleModel);
  const flat = (x) => x.replace(/-/g, "");
  return v === specModelKey || v.startsWith(`${specModelKey}-`) || flat(v) === flat(specModelKey);
}

// Specs that apply to this vehicle. Engine-specific specs only apply when the
// vehicle's engine is known and matches (a 3.0 spec must never reach a 4.0).
export async function getVerifiedSpecs(prisma, vehicle) {
  if (!vehicle?.make || !vehicle?.model || !vehicle?.year) return [];
  const year = Number(vehicle.year);
  const rows = await prisma.vehicleSpec.findMany({
    where: { makeKey: slugKey(vehicle.make), yearFrom: { lte: year }, yearTo: { gte: year } },
    orderBy: { label: "asc" },
  });
  const eng = displacementKey(vehicle.engine) || displacementKey(vehicle.displacement);
  const matching = rows.filter((r) => modelMatches(r.modelKey, vehicle.model) && (!r.engine || (eng && r.engine === eng)));
  // One row per spec: engine-specific beats all-engines, then the narrowest
  // year range, then the most recently updated.
  const best = new Map();
  const rank = (r) => [r.engine ? 0 : 1, r.yearTo - r.yearFrom, -new Date(r.updatedAt).getTime()];
  for (const r of matching) {
    const cur = best.get(r.specKey);
    if (!cur) { best.set(r.specKey, r); continue; }
    const a = rank(r), b = rank(cur);
    if (a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] < b[2])))) best.set(r.specKey, r);
  }
  return [...best.values()].sort((a, b) => a.label.localeCompare(b.label));
}

// Prompt lines: "- Lug nut torque: 89 ft-lbs (120 N·m) (source: owner's manual)"
export function formatSpecsForPrompt(specs) {
  return specs.map((s) => `- ${s.label}: ${s.value} (source: ${s.source}${s.note ? `; ${s.note}` : ""})`).join("\n");
}
