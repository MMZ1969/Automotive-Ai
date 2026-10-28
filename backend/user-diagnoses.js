// user-diagnoses.js — READ ONLY. Every diagnosis a user ran, with what they got back.
//
// DiagnosisLog = one row per diagnosis served (question, vehicle, summary, severity, cached).
// SavedDiagnosis = the full answer, only for ones the user saved.
//
// Usage:  node user-diagnoses.js 235
// Also writes reports/user-<id>-diagnoses.txt
import "dotenv/config";
import fs from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const id = Number(process.argv[2]);
if (!id) { console.error("Usage: node user-diagnoses.js <userId>"); process.exit(1); }

const ts = (d) => new Date(d).toISOString().slice(0, 16).replace("T", " ") + " UTC";
const one = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

async function main() {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      name: true, email: true, totalDiagnoses: true, createdAt: true, lastSeenAt: true,
      vehicles: { select: { id: true, year: true, make: true, model: true, trim: true, engine: true, mileage: true } },
    },
  });
  if (!user) { console.error(`No user ${id}`); process.exit(1); }

  const [logs, saved] = await Promise.all([
    prisma.diagnosisLog.findMany({ where: { userId: id }, orderBy: { createdAt: "asc" } }),
    prisma.savedDiagnosis.findMany({ where: { userId: id }, orderBy: { createdAt: "asc" } }),
  ]);

  const out = [];
  const say = (s = "") => { out.push(s); console.log(s); };
  say(`#${id} ${user.name} <${user.email}> — joined ${ts(user.createdAt)}, last seen ${user.lastSeenAt ? ts(user.lastSeenAt) : "never"}`);
  say(`totalDiagnoses counter: ${user.totalDiagnoses} | DiagnosisLog rows: ${logs.length} | saved: ${saved.length}`);
  say("Vehicles:");
  user.vehicles.forEach((v) => say(`  [${v.id}] ${v.year} ${v.make} ${v.model}${v.trim ? " " + v.trim : ""}${v.engine ? ` | ${v.engine}` : ""}${v.mileage ? ` | ${v.mileage} mi` : ""}`));

  say("\n════ DIAGNOSIS LOG (oldest first) ════");
  let prev = null;
  for (const l of logs) {
    const gap = prev ? ` (+${Math.round((l.createdAt - prev) / 60000)} min)` : "";
    prev = l.createdAt;
    say(`\n${ts(l.createdAt)}${gap} | ${l.vehicleLabel || "NO VEHICLE"} | ${l.cached ? "CACHED" : "fresh"} | severity ${l.severity || "—"}`);
    say(`  Q: ${one(l.query)}`);
    say(`  A: ${one(l.summary) || "(no summary stored)"}`);
  }

  if (saved.length) {
    say("\n════ SAVED DIAGNOSES (full answers) ════");
    for (const s of saved) {
      say(`\n${ts(s.createdAt)} | ${s.vehicleLabel || "NO VEHICLE"} | severity ${s.severity}`);
      say(`  Q: ${one(s.query)}`);
      say(`  Summary: ${one(s.summary)}`);
      if (s.causes?.length) say(`  Causes: ${s.causes.map(one).join(" | ")}`);
      if (s.immediateAction) say(`  Immediate: ${one(s.immediateAction)}`);
      if (s.estimatedCost) say(`  Cost: ${one(s.estimatedCost)} | DIY: ${one(s.diyDifficulty)}`);
      const steps = Array.isArray(s.diagnosisSteps) ? s.diagnosisSteps : [];
      steps.forEach((st, i) => say(`  ${i + 1}. ${one(typeof st === "string" ? st : st.step || st.title || JSON.stringify(st))}${st?.detail ? " — " + one(st.detail) : ""}`));
      if (s.proTip) say(`  Pro tip: ${one(s.proTip)}`);
    }
  }

  fs.mkdirSync("reports", { recursive: true });
  const file = `reports/user-${id}-diagnoses.txt`;
  fs.writeFileSync(file, out.join("\n") + "\n");
  console.log(`\nSaved ${file}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
