// check-mechanic.js — READ ONLY. Why isn't this mechanic on the Near Me map?
// Checks every condition GET /users/mechanics uses, plus the verification state.
//
// Usage:  node check-mechanic.js 264
//         node check-mechanic.js joe@shop.com
//         node check-mechanic.js "Joe"          (name contains, newest first)
//         node check-mechanic.js --recent       (mechanics who signed up or asked to verify in the last 14 days)
import "dotenv/config";
import prisma from "./src/lib/prisma.js";

const arg = process.argv[2];
const DAY = 86400000;
const ago = (d) => (d ? `${Math.floor((Date.now() - new Date(d)) / DAY)}d ago` : "—");

function report(u) {
  let req = null;
  try { req = u.verificationRequest ? JSON.parse(u.verificationRequest) : null; } catch {}
  const checks = [
    [u.role === "MECHANIC", `Role is MECHANIC (is: ${u.role})`, "Signed up as a DIYer. Change role to MECHANIC in Studio, or he re-registers as a mechanic."],
    [u.emailVerified, "Email verified", "Never entered the 6-digit email code. He has to finish that in the app (or resend from login)."],
    [!u.isBanned, "Not banned", "Account is banned."],
    [!!(u.location && u.location.trim()), `Location set (${u.location ? `"${u.location}"` : "none"})`, req?.shopLocation ? `No location, but his verify form says "${req.shopLocation}". Approving him in the admin panel copies it over, or set user.location in Studio.` : "No location anywhere. He sets it in Settings, or you set user.location in Studio (city + state, e.g. \"Absecon, NJ\")."],
  ];
  console.log(`\n#${u.id}  ${u.name}  <${u.email}>  joined ${u.createdAt.toISOString().slice(0, 10)} (${ago(u.createdAt)})`);
  console.log(`  last seen: ${u.lastSeenAt ? `${u.lastSeenAt.toISOString().slice(0, 16).replace("T", " ")} UTC (${ago(u.lastSeenAt)})` : "—"} | push ${u.pushToken ? "✓" : "✗"}`);
  console.log("\n  NEAR ME (all must pass):");
  for (const [ok, label, fix] of checks) console.log(`    ${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n        → ${fix}`}`);
  console.log("\n  VERIFIED BADGE (gold 🏁 pin):");
  if (u.isVerified) console.log("    ✓ Approved");
  else if (req) console.log(`    … Request waiting for your approval (submitted ${ago(req.submittedAt)}) → Admin panel → Verification requests`);
  else console.log("    ✗ Never submitted a verification request (Profile → Get Verified)");
  if (req) {
    console.log(`      shop: ${req.shopName || "—"} | shop location: ${req.shopLocation || "—"} | ASE/cert: ${req.licenseNumber || "—"} | proof photo: ${req.proofPhotoUrl ? "yes" : "no"}${req.experience ? ` | experience: ${req.experience}` : ""}`);
  }
  const loc = (u.location || "").trim();
  if (loc && !/,|\b[A-Z]{2}\b|\d{5}/.test(loc)) {
    console.log(`\n  ⚠ Location "${loc}" has no state or ZIP. Google may place it somewhere else (another town with that name). Make it "Town, ST" or a ZIP.`);
  }
  const allPass = checks.every(([ok]) => ok);
  console.log(`\n  → ${allPass ? "Should be on Near Me. If you still don't see him: zoom out / check the pin's spot, and confirm Google can find the location text." : "Not on Near Me until the ✗ items are fixed."}\n`);
}

async function main() {
  const select = { id: true, name: true, email: true, role: true, emailVerified: true, isBanned: true, isVerified: true, location: true, verificationRequest: true, createdAt: true, lastSeenAt: true, pushToken: true };
  let users = [];
  if (!arg) {
    console.log('Usage: node check-mechanic.js <id | email | name> | --recent');
    return;
  } else if (arg === "--recent") {
    const since = new Date(Date.now() - 14 * DAY);
    users = (await prisma.user.findMany({ where: { OR: [{ role: "MECHANIC", createdAt: { gte: since } }, { verificationRequest: { not: null }, updatedAt: { gte: since } }] }, select, orderBy: { createdAt: "desc" } }));
  } else if (/^\d+$/.test(arg)) {
    users = await prisma.user.findMany({ where: { id: Number(arg) }, select });
  } else if (arg.includes("@")) {
    users = await prisma.user.findMany({ where: { email: { equals: arg, mode: "insensitive" } }, select });
  } else {
    users = await prisma.user.findMany({ where: { name: { contains: arg, mode: "insensitive" } }, select, orderBy: { createdAt: "desc" }, take: 5 });
  }
  if (!users.length) return console.log(`No user found for "${arg}".`);
  users.forEach(report);
}

main().catch((e) => console.error(e)).finally(() => prisma.$disconnect());
