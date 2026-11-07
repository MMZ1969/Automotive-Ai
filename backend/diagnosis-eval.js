// diagnosis-eval.js — asks the SAME questions several times per model, with the
// exact production prompt, and compares the specs that come back.
// Question it answers: "does the same car get the same torque/size every time?"
// Writes nothing to the DB. Costs real API money (estimate printed first).
//
// Usage:  node diagnosis-eval.js                         (all cases, 3 runs, both models)
//         node diagnosis-eval.js --runs 2
//         node diagnosis-eval.js --models claude-sonnet-4-5,claude-sonnet-5-5
//         node diagnosis-eval.js --case lug               (only cases whose id contains "lug")
//         node diagnosis-eval.js --with-specs             (inject verified specs from the DB, like production)
// Output: console + reports/diagnosis-eval.txt (+ reports/diagnosis-eval-raw.json)
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { buildDiagnosisPrompt, DIAGNOSIS_MAX_TOKENS, DIAGNOSIS_MAX_SEARCHES } from "./src/lib/diagnosisPrompt.js";

const RENEGADE = { year: 2017, make: "Jeep", model: "Renegade", trim: "Sport", engine: "2.4L", engineCylinders: 4, driveType: "AWD" };
const CASES = [
  { id: "renegade-lug", vehicle: RENEGADE, query: "lug nut torque" },
  { id: "renegade-struts", vehicle: RENEGADE, query: "front strut replacement" },
  { id: "renegade-oil", vehicle: RENEGADE, query: "oil change" },
  { id: "ranger-pulley", vehicle: { year: 2003, make: "Ford", model: "Ranger", engine: "3.0L", engineCylinders: 6, driveType: "RWD" }, query: "water pump pulley is cracked where it bolts on, how do I replace it" },
  { id: "f150-oil", vehicle: { year: 2010, make: "Ford", model: "F-150", engine: "4.6L", engineCylinders: 8, driveType: "4WD" }, query: "oil leaking onto starter" },
];

// $ per million tokens [input, output]; web search is $10 per 1,000 searches.
const PRICES = { "claude-sonnet-4-5": [3, 15], "claude-sonnet-5-5": [3, 15], "claude-opus-4-5": [5, 25], "claude-opus-5-5": [5, 25], "claude-haiku-4-5": [1, 5] };

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def; };
const RUNS = Math.max(1, Number(arg("runs", 3)));
const MODELS = arg("models", "claude-sonnet-4-5,claude-sonnet-5-5").split(",").map((s) => s.trim()).filter(Boolean);
const only = arg("case", "");
const WITH_SPECS = process.argv.includes("--with-specs");
const cases = CASES.filter((c) => !only || c.id.includes(only));

const out = [];
const log = (s = "") => { console.log(s); out.push(s); };
const one = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const stepText = (st) => (typeof st === "string" ? st : st && typeof st === "object" ? `${st.step || st.text || ""} ${st.detail || ""}` : "");

// Pull every torque / size / capacity claim out of the answer, normalized,
// e.g. "89 ft-lbs", "120 nm", "17mm", "5 qt". Ranges kept as written ("6-9 ft-lbs").
function extractSpecs(result) {
  const text = [...(result.diagnosisSteps || []).map(stepText), result.proTip || "", result.immediateAction || ""].join(" \n ");
  const specs = new Set();
  const re = /(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?)\s*(ft[\s.-]*lbs?|lb[\s.-]*ft|foot[\s-]*pounds?|in[\s.-]*lbs?|inch[\s-]*pounds?|n[\s·⋅.-]*m\b|mm\b|quarts?\b|qts?\b|liters?\b|l\b)/gi;
  for (const m of text.matchAll(re)) {
    const num = m[1].replace(/\s+/g, "").replace("–", "-");
    let unit = m[2].toLowerCase().replace(/[\s.·⋅-]/g, "");
    if (/^(ftlbs?|lbft|footpounds?)$/.test(unit)) unit = "ft-lbs";
    else if (/^(inlbs?|inchpounds?)$/.test(unit)) unit = "in-lbs";
    else if (unit === "nm") unit = "Nm";
    else if (/^(quarts?|qts?)$/.test(unit)) unit = "qt";
    else if (/^(liters?|l)$/.test(unit)) unit = "L";
    specs.add(`${num} ${unit}`.replace(" mm", "mm"));
  }
  return [...specs];
}
const hedges = (result) => [...(result.diagnosisSteps || []).map(stepText), result.proTip || ""]
  .filter((t) => /sources (vary|disagree|differ)|not confirmed|verify|confirm (the|your) exact|check your owner/i.test(t)).length;

async function runOnce(model, c, verifiedSpecs = []) {
  const t0 = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: DIAGNOSIS_MAX_TOKENS,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: DIAGNOSIS_MAX_SEARCHES }],
      messages: [{ role: "user", content: buildDiagnosisPrompt({ query: c.query, vehicle: c.vehicle, verifiedSpecs }) }],
    }),
  });
  const data = await res.json();
  const ms = Date.now() - t0;
  if (data.type === "error") return { error: data.error?.message || "API error", ms };
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").replace(/```json|```/g, "");
  const m = text.match(/\{[\s\S]*\}/);
  let result = null;
  try { result = m ? JSON.parse(m[0]) : null; } catch { /* truncated or malformed */ }
  const u = data.usage || {};
  const searches = u.server_tool_use?.web_search_requests ?? 0;
  const [pin, pout] = PRICES[model] || [3, 15];
  const cost = ((u.input_tokens || 0) * pin + (u.output_tokens || 0) * pout) / 1e6 + searches * 0.01;
  return { ms, searches, cost, stop: data.stop_reason, result, specs: result ? extractSpecs(result) : [], hedges: result ? hedges(result) : 0 };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY missing from backend/.env");
  const total = cases.length * MODELS.length * RUNS;
  log(`\n══════════ DIAGNOSIS CONSISTENCY EVAL — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC ══════════`);
  log(`${cases.length} questions × ${MODELS.length} models × ${RUNS} runs = ${total} diagnoses. Expect roughly $${(total * 0.08).toFixed(2)}–$${(total * 0.2).toFixed(2)} and ${Math.ceil(total * 35 / 60)} min.`);
  log(`Models: ${MODELS.join(", ")}\n`);

  // Verified specs per case, loaded the same way the server does
  const specsFor = {};
  if (WITH_SPECS) {
    const { PrismaClient } = await import("@prisma/client");
    const { getVerifiedSpecs } = await import("./src/lib/vehicleSpecs.js");
    const prisma = new PrismaClient();
    for (const c of cases) specsFor[c.id] = await getVerifiedSpecs(prisma, c.vehicle);
    await prisma.$disconnect();
  }
  log(`Verified specs: ${WITH_SPECS ? "ON (from DB)" : "off (use --with-specs to inject them like production)"}\n`);

  const raw = [];
  const summary = {}; // model -> {ms, cost, searches, n, errors, consistent, cases}
  for (const c of cases) {
    log("────────────────────────────────────────────────────────────────────────");
    log(`${c.id}: ${c.vehicle.year} ${c.vehicle.make} ${c.vehicle.model} ${c.vehicle.engine || ""} — "${c.query}"`);
    if (WITH_SPECS) log(`  verified specs injected: ${(specsFor[c.id] || []).map((x) => `${x.label} = ${x.value}`).join("; ") || "none for this vehicle"}`);
    for (const model of MODELS) {
      const s = (summary[model] ||= { ms: 0, cost: 0, searches: 0, n: 0, errors: 0, consistent: 0, cases: 0 });
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        process.stdout.write(`  ${model} run ${i + 1}/${RUNS}…\r`);
        const r = await runOnce(model, c, specsFor[c.id] || []);
        runs.push(r);
        raw.push({ case: c.id, model, run: i + 1, ...r });
        if (r.error || !r.result) { s.errors++; continue; }
        s.ms += r.ms; s.cost += r.cost; s.searches += r.searches; s.n++;
      }
      log(`\n  ${model}`);
      runs.forEach((r, i) => {
        if (r.error) return log(`    run ${i + 1}: ERROR ${r.error}`);
        if (!r.result) return log(`    run ${i + 1}: unparseable answer (stop=${r.stop})`);
        log(`    run ${i + 1}: ${(r.ms / 1000).toFixed(0)}s, ${r.searches} searches, $${r.cost.toFixed(3)}, ${r.hedges} hedged step(s)`);
        log(`           summary: ${one(r.result.summary).slice(0, 110)}`);
        log(`           specs:   ${r.specs.join(" · ") || "(none stated)"}`);
      });
      const good = runs.filter((r) => r.result);
      if (good.length > 1) {
        const sets = good.map((r) => new Set(r.specs));
        const all = new Set(good.flatMap((r) => r.specs));
        const inAll = [...all].filter((x) => sets.every((st) => st.has(x)));
        const notAll = [...all].filter((x) => !inAll.includes(x));
        const same = notAll.length === 0;
        s.cases++; if (same) s.consistent++;
        log(`    → in every run: ${inAll.join(" · ") || "—"}`);
        log(`    → differs between runs: ${notAll.join(" · ") || "nothing — consistent ✓"}`);
      }
    }
    log("");
  }

  log("═══════════════ SUMMARY ═══════════════");
  for (const [model, s] of Object.entries(summary)) {
    log(`${model}: specs identical across runs in ${s.consistent}/${s.cases} questions | avg ${s.n ? (s.ms / s.n / 1000).toFixed(0) : "—"}s | avg ${s.n ? (s.searches / s.n).toFixed(1) : "—"} searches | avg $${s.n ? (s.cost / s.n).toFixed(3) : "—"} per diagnosis | ${s.errors} failed`);
  }
  log("\nNote: a spec appearing in only some runs isn't automatically wrong (one run may just include more detail), but a DIFFERENT number for the same fastener is the problem we're hunting.");

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/diagnosis-eval.txt", out.join("\n"));
  writeFileSync("reports/diagnosis-eval-raw.json", JSON.stringify(raw, null, 2));
  console.log("\nSaved → reports/diagnosis-eval.txt (+ diagnosis-eval-raw.json)");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
