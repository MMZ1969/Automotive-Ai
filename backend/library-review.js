// library-review.js — prepares diagnosis answers for the public library.
// Writes to the DB only to (1) backfill and (2) store suggested titles; never publishes.
//
//   1. Backfill: copies full answers users SAVED before the DiagnosisAnswer table
//      existed (10/28) into DiagnosisAnswer, so they can become pages too.
//   2. For every answer not yet published or rejected that has a vehicle, asks
//      Claude (cheap model) for a clean title, URL slug and a rewritten question
//      with personal details removed, plus a "publishable?" call. Stored on the row.
//   3. Writes reports/library-review.txt for Michael to read.
//
// Then approve with:  node library-publish.js <id> <id> ...
//
// Usage:  node library-review.js          (only rows without a suggestion yet)
//         node library-review.js --redo 12 15   (re-suggest these ids)
// Output: console + reports/library-review.txt  (gitignored: has raw user questions)
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "fs";
import { cacheKeyFor, hashKey, slugify, displayName, stepText } from "./library-lib.js";

const prisma = new PrismaClient();
const MODEL = "claude-haiku-4-5";
const args = process.argv.slice(2);
const redo = args[0] === "--redo" ? new Set(args.slice(1).map(Number)) : new Set();

const out = [];
const log = (s = "") => { console.log(s); out.push(s); };
const one = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// ── 1. Backfill saved diagnoses ──────────────────────────────────────────────
async function backfillSaved() {
  const saved = await prisma.savedDiagnosis.findMany({
    where: { vehicleId: { not: null } },
    include: { vehicle: true },
    orderBy: { createdAt: "asc" },
  });
  let added = 0;
  for (const s of saved) {
    if (!s.vehicle || !one(s.query)) continue;
    const queryKey = hashKey(cacheKeyFor(s.query, s.vehicle));
    const exists = await prisma.diagnosisAnswer.findUnique({ where: { queryKey }, select: { id: true } });
    if (exists) continue;
    const v = s.vehicle;
    await prisma.diagnosisAnswer.create({
      data: {
        queryKey,
        vehicleLabel: [v.year, v.make, v.model, v.trim].filter(Boolean).join(" "),
        year: v.year, make: v.make, model: v.model, engine: v.engine || null,
        query: String(s.query).slice(0, 2000),
        result: {
          summary: s.summary, severity: s.severity, causes: s.causes,
          estimatedCost: s.estimatedCost, diyDifficulty: s.diyDifficulty,
          immediateAction: s.immediateAction, diagnosisSteps: s.diagnosisSteps,
          proTip: s.proTip, ebayParts: s.ebayParts || [],
        },
        // Old timestamp: the live cache treats it as expired, so it's library-only.
        generatedAt: s.createdAt,
        reviewNote: "backfilled from SavedDiagnosis",
      },
    });
    added++;
  }
  return added;
}

// ── 2. Suggestions from Claude ───────────────────────────────────────────────
async function suggest(row) {
  const r = row.result || {};
  const vehicle = `${row.year} ${row.make} ${row.model}${row.engine ? ` (${row.engine})` : ""}`;
  const prompt = `You prepare car-repair Q&A for a public website of repair guides. Given a user's question to an AI mechanic and the answer summary, return ONLY JSON:
{"title": "...", "slug": "...", "publicQuestion": "...", "publishable": true, "reason": "..."}

- title: "<Year> <Make> <Model>: <problem in 3-8 plain words>", e.g. "2003 Ford Ranger: cracked water pump pulley". Use proper capitalization for the make/model.
- slug: the problem part only, lowercase words joined by hyphens, max 6 words, no year/make/model. e.g. "cracked-water-pump-pulley"
- publicQuestion: the user's question rewritten as one or two clear sentences a reader would search for. Remove ALL personal details (names, places, phone numbers, family, money situations, anything identifying). Fix voice-to-text errors. Keep the actual symptoms.
- publishable: false if it isn't a real vehicle problem, is too vague to be useful to others, is a duplicate-sounding generic question with no symptoms, or contains content that shouldn't be public. Otherwise true.
- reason: a few words explaining publishable.

Vehicle: ${vehicle}
User's question: "${one(row.query).slice(0, 800)}"
Answer summary: "${one(r.summary).slice(0, 300)}"
Top causes: ${(r.causes || []).slice(0, 3).map((c) => `"${one(c).slice(0, 120)}"`).join(", ")}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`no JSON from model: ${JSON.stringify(data).slice(0, 200)}`);
  return JSON.parse(m[0]);
}

// Unique slug within make/model: "<year>-<problem>", then -2, -3 on collision.
async function uniqueSlug(row, problemSlug) {
  const base = slugify(`${row.year}-${problemSlug || "problem"}`, 70) || `${row.year}-problem`;
  let slug = base, n = 2;
  for (;;) {
    const clash = await prisma.diagnosisAnswer.findFirst({
      where: { make: row.make, model: row.model, slug, NOT: { id: row.id } },
      select: { id: true },
    });
    if (!clash) return slug;
    slug = `${base}-${n++}`;
  }
}

async function main() {
  const added = await backfillSaved();

  const rows = await prisma.diagnosisAnswer.findMany({
    where: { publishedAt: null, rejectedAt: null },
    orderBy: { createdAt: "asc" },
  });
  const noVehicle = rows.filter((r) => !r.make || !r.model || !r.year);
  const candidates = rows.filter((r) => r.make && r.model && r.year);
  const published = await prisma.diagnosisAnswer.count({ where: { publishedAt: { not: null } } });

  const haveKey = !!process.env.ANTHROPIC_API_KEY;
  let suggested = 0, failed = 0;
  for (const row of candidates) {
    if (row.title && !redo.has(row.id)) continue;
    if (!haveKey) break;
    try {
      const s = await suggest(row);
      const slug = await uniqueSlug(row, slugify(s.slug || s.title));
      const note = s.publishable === false ? `AI says skip: ${one(s.reason)}` : (row.reviewNote || null);
      await prisma.diagnosisAnswer.update({
        where: { id: row.id },
        data: { title: one(s.title).slice(0, 140), slug, publicQuestion: one(s.publicQuestion).slice(0, 400), reviewNote: note },
      });
      Object.assign(row, { title: one(s.title), slug, publicQuestion: one(s.publicQuestion), reviewNote: note });
      suggested++;
    } catch (err) {
      failed++;
      console.error(`  suggestion failed for #${row.id}: ${err.message}`);
    }
  }

  // ── 3. Report ──────────────────────────────────────────────────────────────
  log(`\n══════════ LIBRARY REVIEW — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC ══════════`);
  log(`Published already: ${published} | waiting for review: ${candidates.length} | no vehicle (can't publish): ${noVehicle.length}`);
  log(`Backfilled from saved diagnoses this run: ${added} | new suggestions: ${suggested}${failed ? ` | failed: ${failed}` : ""}`);
  if (!haveKey) log("⚠ ANTHROPIC_API_KEY not set in backend/.env — no title suggestions were made.");
  log("\nApprove:   node library-publish.js <id> <id> ...");
  log("Reject:    node library-publish.js --reject <id> ...");
  log("Re-suggest: node library-review.js --redo <id> ...\n");

  for (const r of candidates) {
    const res = r.result || {};
    const steps = Array.isArray(res.diagnosisSteps) ? res.diagnosisSteps : [];
    log("────────────────────────────────────────────────────────────────────────");
    log(`#${r.id}  ${r.year} ${displayName(r.make)} ${displayName(r.model)}${r.engine ? ` (${r.engine})` : " — NO ENGINE"}  | served ${r.hitCount}x | ${r.generatedAt.toISOString().slice(0, 10)}`);
    log(`  Title:     ${r.title || "(no suggestion yet)"}`);
    log(`  URL:       /problems/${slugify(r.make)}/${slugify(r.model)}/${r.slug || "?"}/`);
    log(`  Public Q:  ${r.publicQuestion || "—"}`);
    log(`  User's Q:  ${one(r.query).slice(0, 300)}   ← private, never published`);
    log(`  Answer:    ${one(res.summary)}`);
    log(`  Severity ${res.severity || "—"} | ${res.estimatedCost || "—"} | DIY ${res.diyDifficulty || "—"} | ${steps.length} steps`);
    if (r.reviewNote) log(`  Note:      ${r.reviewNote}`);
    // Torque/size claims are what to double-check before approving
    const specs = steps.map(stepText).filter((t) => /ft-?lbs?|in-?lbs?|n·?m|\b\d{1,2}\s?mm\b/i.test(t));
    if (specs.length) {
      log(`  Specs to sanity-check:`);
      specs.slice(0, 6).forEach((t) => log(`    · ${one(t).slice(0, 160)}`));
    }
  }
  if (noVehicle.length) {
    log("\n───── No vehicle on these (not publishable; listed for reference) ─────");
    noVehicle.slice(-15).forEach((r) => log(`  #${r.id}  ${one(r.query).slice(0, 90)}`));
  }
  log("");

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/library-review.txt", out.join("\n"));
  console.log("Saved → reports/library-review.txt");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
