// library-publish.js — approve, reject or unpublish library answers by ID.
// Changes only the publishedAt / rejectedAt stamps. Pages change when you run
// build-library-pages.js and push.
//
// Usage:  node library-publish.js 12 15 18            approve (publish)
//         node library-publish.js --reject 14 16       reject (hidden from review)
//         node library-publish.js --unpublish 12       take a page down
//         node library-publish.js --list               show what's published
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { slugify } from "./library-lib.js";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const mode = ["--reject", "--unpublish", "--list"].includes(args[0]) ? args.shift() : "--publish";
const ids = args.map(Number).filter((n) => Number.isInteger(n) && n > 0);

async function main() {
  if (mode === "--list") {
    const rows = await prisma.diagnosisAnswer.findMany({
      where: { publishedAt: { not: null } },
      orderBy: [{ make: "asc" }, { model: "asc" }, { year: "asc" }],
      select: { id: true, title: true, make: true, model: true, slug: true, publishedAt: true, hitCount: true },
    });
    console.log(`${rows.length} published:`);
    rows.forEach((r) => console.log(`  #${r.id}  ${r.title}  → /problems/${slugify(r.make)}/${slugify(r.model)}/${r.slug}/  (served ${r.hitCount}x)`));
    return;
  }
  if (!ids.length) {
    console.error("Give one or more ids. e.g.  node library-publish.js 12 15   (see reports/library-review.txt)");
    process.exitCode = 1;
    return;
  }

  for (const id of ids) {
    const row = await prisma.diagnosisAnswer.findUnique({
      where: { id },
      select: { id: true, title: true, slug: true, make: true, model: true, year: true, publishedAt: true },
    });
    if (!row) { console.log(`  #${id}: not found`); continue; }

    if (mode === "--publish") {
      if (!row.make || !row.model || !row.year) { console.log(`  #${id}: no vehicle — can't publish`); continue; }
      if (!row.title || !row.slug) { console.log(`  #${id}: no title/slug yet — run node library-review.js first`); continue; }
      await prisma.diagnosisAnswer.update({ where: { id }, data: { publishedAt: row.publishedAt || new Date(), rejectedAt: null } });
      console.log(`  ✓ #${id} published: ${row.title}  → /problems/${slugify(row.make)}/${slugify(row.model)}/${row.slug}/`);
    } else if (mode === "--reject") {
      await prisma.diagnosisAnswer.update({ where: { id }, data: { rejectedAt: new Date(), publishedAt: null } });
      console.log(`  ✗ #${id} rejected${row.title ? `: ${row.title}` : ""}`);
    } else if (mode === "--unpublish") {
      await prisma.diagnosisAnswer.update({ where: { id }, data: { publishedAt: null } });
      console.log(`  ↓ #${id} unpublished${row.title ? `: ${row.title}` : ""} (back in the review list)`);
    }
  }
  console.log("\nNext: node build-library-pages.js  → then git add docs; git commit; git push");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
