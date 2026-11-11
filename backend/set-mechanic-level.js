// set-mechanic-level.js — set a mechanic's badge level by hand. Changes only
// isVerified / isCertified on that one user; sends no notification.
//
//   node set-mechanic-level.js 271 verified     blue ✓  Verified Mechanic (proven real, no license)
//   node set-mechanic-level.js 271 certified    gold 🏁 Certified Mechanic (license / ASE checked)
//   node set-mechanic-level.js 271 none         grey 🔧 Mechanic (badge removed)
//   node set-mechanic-level.js --list           every Verified / Certified mechanic
//
// The first argument can also be an email address.
import "dotenv/config";
import prisma from "./src/lib/prisma.js";

const [who, levelArg] = process.argv.slice(2);
const LEVELS = {
  certified: { isVerified: true, isCertified: true, label: "🏁 Certified Mechanic" },
  verified: { isVerified: true, isCertified: false, label: "✓ Verified Mechanic" },
  none: { isVerified: false, isCertified: false, label: "🔧 Mechanic (no badge)" },
};
const labelOf = (u) => (u.isCertified ? LEVELS.certified.label : u.isVerified ? LEVELS.verified.label : LEVELS.none.label);
const select = { id: true, name: true, email: true, role: true, isVerified: true, isCertified: true, location: true };

async function main() {
  if (who === "--list") {
    const rows = await prisma.user.findMany({ where: { isVerified: true }, select, orderBy: { id: "asc" } });
    console.log(rows.length ? rows.map((u) => `  #${u.id}  ${u.name}  <${u.email}>  ${labelOf(u)}${u.location ? `  📍 ${u.location}` : ""}`).join("\n") : "No verified mechanics.");
    return;
  }
  const level = LEVELS[String(levelArg || "").toLowerCase()];
  if (!who || !level) {
    console.log("Usage: node set-mechanic-level.js <id | email> certified|verified|none   (or --list)");
    process.exitCode = 1;
    return;
  }
  const where = /^\d+$/.test(who) ? { id: Number(who) } : { email: who };
  const user = await prisma.user.findFirst({ where, select });
  if (!user) { console.log(`No user found for "${who}".`); process.exitCode = 1; return; }
  if (user.role !== "MECHANIC" && level !== LEVELS.none) console.log(`⚠ ${user.name} is a ${user.role}, not a MECHANIC. Badge set anyway; it only shows for mechanics.`);
  const before = labelOf(user);
  const updated = await prisma.user.update({ where: { id: user.id }, data: { isVerified: level.isVerified, isCertified: level.isCertified }, select });
  console.log(`#${user.id} ${user.name}: ${before}  →  ${labelOf(updated)}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
