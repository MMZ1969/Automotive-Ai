// vehicle-specs.js — manage VERIFIED specs (spec memory). Every diagnosis for a
// matching vehicle is told to use these exact values.
//
// Add (quote anything with spaces):
//   node vehicle-specs.js add --year 2017 --make Jeep --model Renegade --spec "Lug nut torque" --value "89 ft-lbs (120 N·m)" --source "owner's manual"
// Options:
//   --to 2018         also covers 2018 (a range: --year 2015 --to 2018)
//   --engine 2.4      only for that engine (displacement). Leave off when it's
//                     the same for every engine, e.g. lug torque.
//   --note "..."      extra context shown to the AI, e.g. "alloy wheels"
// Adding the same spec again (same vehicle/years/engine/name) updates it.
//
// List:    node vehicle-specs.js list               (everything)
//          node vehicle-specs.js list jeep renegade
// Remove:  node vehicle-specs.js remove <id>
//
// When a spec is added or changed, cached answers for those vehicles are marked
// expired, so the next ask regenerates with the verified value. Published
// library pages are never touched automatically; any that mention a different
// number for that spec are listed for you to check.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { slugKey, displacementKey } from "./src/lib/vehicleSpecs.js";

const prisma = new PrismaClient();
const [cmd, ...rest] = process.argv.slice(2);

function flags(args) {
  const f = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) { f[args[i].slice(2)] = args[i + 1]; i++; }
  }
  return f;
}
const show = (r) => `#${r.id}  ${r.yearFrom === r.yearTo ? r.yearFrom : `${r.yearFrom}–${r.yearTo}`} ${r.makeKey} ${r.modelKey}${r.engine ? ` ${r.engine}L` : ""}  |  ${r.label}: ${r.value}  (${r.source}${r.note ? `; ${r.note}` : ""}) — ${r.verifiedBy}, ${r.updatedAt.toISOString().slice(0, 10)}`;

// The first number+unit in a value, for spotting conflicting numbers in pages: "89 ft-lbs"
const mainNumber = (v) => {
  const m = /(\d+(?:\.\d+)?)\s*(ft[\s.-]*lbs?|lb[\s.-]*ft|in[\s.-]*lbs?|n[\s·⋅.-]*m|mm|qt|quarts?|l\b)/i.exec(v || "");
  return m ? { num: m[1], unit: m[2].toLowerCase().replace(/[\s.·⋅-]/g, "") } : null;
};

async function add(f) {
  const missing = ["year", "make", "model", "spec", "value", "source"].filter((k) => !f[k]);
  if (missing.length) {
    console.error(`Missing: ${missing.map((k) => `--${k}`).join(" ")}\nExample: node vehicle-specs.js add --year 2017 --make Jeep --model Renegade --spec "Lug nut torque" --value "89 ft-lbs (120 N·m)" --source "owner's manual"`);
    process.exitCode = 1;
    return;
  }
  const yearFrom = Number(f.year), yearTo = Number(f.to || f.year);
  if (!(yearFrom > 1900 && yearTo >= yearFrom && yearTo < 2100)) { console.error("Bad --year/--to"); process.exitCode = 1; return; }
  const engine = f.engine ? displacementKey(f.engine) : "";
  if (f.engine && !engine) { console.error(`Couldn't read an engine size from "${f.engine}". Use e.g. --engine 2.4`); process.exitCode = 1; return; }
  const key = { makeKey: slugKey(f.make), modelKey: slugKey(f.model), yearFrom, yearTo, engine, specKey: slugKey(f.spec) };
  const data = { label: f.spec.trim(), value: f.value.trim(), source: f.source.trim(), note: f.note?.trim() || null, verifiedBy: f.by?.trim() || "MAZ" };

  const row = await prisma.vehicleSpec.upsert({
    where: { makeKey_modelKey_yearFrom_yearTo_engine_specKey: key },
    create: { ...key, ...data },
    update: data,
  });
  console.log(`✓ saved ${show(row)}`);

  // Expire cached (unpublished) answers for these vehicles so they regenerate.
  const answers = await prisma.diagnosisAnswer.findMany({
    where: { year: { gte: yearFrom, lte: yearTo } },
    select: { id: true, make: true, model: true, engine: true, publishedAt: true, title: true, slug: true, result: true },
  });
  const flat = (x) => x.replace(/-/g, "");
  const matches = answers.filter((a) => {
    if (slugKey(a.make) !== key.makeKey) return false;
    const m = slugKey(a.model);
    if (!(m === key.modelKey || m.startsWith(`${key.modelKey}-`) || flat(m) === flat(key.modelKey))) return false;
    return !engine || displacementKey(a.engine) === engine;
  });
  const toExpire = matches.filter((a) => !a.publishedAt).map((a) => a.id);
  if (toExpire.length) {
    await prisma.diagnosisAnswer.updateMany({ where: { id: { in: toExpire } }, data: { generatedAt: new Date("2000-01-01T00:00:00Z") } });
  }
  console.log(`  ${toExpire.length} cached answer(s) for this vehicle expired — they'll regenerate with the verified value (the live server picks this up within an hour).`);

  // Published pages that state a different number for THIS spec: same unit,
  // within ~80 characters of a word from the spec's name ("lug", "drain plug").
  const want = mainNumber(data.value);
  const GENERIC = new Set(["torque", "nut", "nuts", "bolt", "bolts", "spec", "size", "socket", "the", "and", "for"]);
  const words = data.label.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3 && !GENERIC.has(w));
  const unitRe = !want ? null
    : want.unit.startsWith("ft") || want.unit.startsWith("lb") ? "(?:ft[\\s.-]*lbs?|lb[\\s.-]*ft)"
    : want.unit.startsWith("in") ? "in[\\s.-]*lbs?"
    : want.unit === "nm" ? "n[\\s·⋅.-]*m"
    : want.unit.startsWith("q") ? "(?:qt|quarts?)"
    : want.unit;
  const flagged = [];
  for (const p of matches.filter((a) => a.publishedAt)) {
    if (!want || !words.length) break;
    const text = JSON.stringify(p.result).toLowerCase();
    const others = new Set();
    for (const m of text.matchAll(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unitRe}`, "gi"))) {
      // Look back up to 80 chars, but stop at the start of the step or sentence
      let before = text.slice(Math.max(0, m.index - 80), m.index);
      const cut = Math.max(before.lastIndexOf('","'), before.lastIndexOf(". "), before.lastIndexOf('["'));
      if (cut >= 0) before = before.slice(cut);
      const around = before + m[0];
      if (words.some((w) => around.includes(w)) && m[1] !== want.num) others.add(m[1]);
    }
    if (others.size) flagged.push(`#${p.id} "${p.title}" says ${[...others].join(", ")} near "${words.join("/")}" (verified: ${want.num})`);
  }
  if (flagged.length) {
    console.log(`  ⚠ Published pages for this vehicle with a different ${data.label.toLowerCase()} — check them (unpublish with node library-publish.js --unpublish <id> if wrong):`);
    flagged.forEach((x) => console.log(`    ${x}`));
  }
}

async function list(make, model) {
  const where = {};
  if (make) where.makeKey = slugKey(make);
  if (model) where.modelKey = slugKey(model);
  const rows = await prisma.vehicleSpec.findMany({ where, orderBy: [{ makeKey: "asc" }, { modelKey: "asc" }, { yearFrom: "asc" }, { label: "asc" }] });
  console.log(rows.length ? rows.map(show).join("\n") : "No verified specs yet.");
}

async function remove(id) {
  const n = Number(id);
  if (!n) { console.error("Usage: node vehicle-specs.js remove <id>"); process.exitCode = 1; return; }
  const row = await prisma.vehicleSpec.delete({ where: { id: n } }).catch(() => null);
  console.log(row ? `✗ removed ${show(row)}` : `#${n} not found`);
}

async function main() {
  if (cmd === "add") return add(flags(rest));
  if (cmd === "list") return list(rest[0], rest[1]);
  if (cmd === "remove") return remove(rest[0]);
  console.log("Usage:\n  node vehicle-specs.js add --year 2017 --make Jeep --model Renegade --spec \"Lug nut torque\" --value \"89 ft-lbs (120 N·m)\" --source \"owner's manual\"\n  node vehicle-specs.js list [make] [model]\n  node vehicle-specs.js remove <id>");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
