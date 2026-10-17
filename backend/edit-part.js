// edit-part.js: fix a parts listing from the command line (until the in-app editor ships in 1.0.24).
//   node edit-part.js                                list all AVAILABLE listings with ids
//   node edit-part.js 7 --title "2016 Jeep Renegade (whole vehicle)"   preview the change
//   node edit-part.js 7 --title "..." --confirm      write it
// Other flags: --price 4800  --description "..."  --category Body  --status SOLD
//   node edit-part.js 9 --delete             preview deleting listing #9
//   node edit-part.js 9 --delete --confirm   delete it
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

async function main() {
  const id = Number(args[0]);
  if (!id) {
    const parts = await prisma.part.findMany({ where: { status: "AVAILABLE" }, orderBy: { id: "asc" },
      select: { id: true, title: true, price: true, priceType: true, user: { select: { name: true, email: true } } } });
    parts.forEach((p) => console.log(`#${p.id}  ${p.title}  |  ${p.price ?? "-"} ${p.priceType}  |  ${p.user?.name} <${p.user?.email}>`));
    return;
  }
  if (args.includes("--delete")) {
    const p = await prisma.part.findUnique({ where: { id }, include: { user: { select: { name: true, email: true } } } });
    if (!p) throw new Error(`No listing #${id}`);
    console.log(`Delete #${p.id} "${p.title}" by ${p.user?.name} <${p.user?.email}>`);
    if (!args.includes("--confirm")) return console.log("Preview only. Add --confirm to delete.");
    await prisma.part.delete({ where: { id } });
    return console.log("Deleted.");
  }
  const data = {};
  if (flag("--title") !== undefined) data.title = flag("--title");
  if (flag("--description") !== undefined) data.description = flag("--description");
  if (flag("--category") !== undefined) data.category = flag("--category");
  if (flag("--price") !== undefined) data.price = parseFloat(flag("--price"));
  if (flag("--status") !== undefined) data.status = flag("--status");
  const before = await prisma.part.findUnique({ where: { id } });
  if (!before) throw new Error(`No listing #${id}`);
  console.log("Before:", { title: before.title, price: before.price, category: before.category });
  console.log("Change:", data);
  if (!args.includes("--confirm")) return console.log("Preview only. Add --confirm to save.");
  await prisma.part.update({ where: { id }, data });
  console.log("Saved.");
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
