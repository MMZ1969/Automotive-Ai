// backfill-referral-codes.js
// One-time script — generates a referral code for every existing user
// who doesn't have one yet (all 50 current users, since the schema
// field just switched from required-with-default to optional-no-default).
// Safe to re-run; only touches users where referralCode is null.

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function generateCode() {
  // 6-char uppercase alphanumeric, e.g. "A3F9K2" — short enough to type
  // or read aloud, long enough that collisions are effectively a non-issue
  // at this user count.
  return crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
}

async function main() {
  const usersWithoutCode = await prisma.user.findMany({
    where: { referralCode: null },
    select: { id: true, email: true },
  });

  console.log(`Found ${usersWithoutCode.length} user(s) without a referral code.\n`);

  let updated = 0;
  for (const user of usersWithoutCode) {
    let code = generateCode();
    let attempts = 0;

    // Retry on the rare collision — unique constraint will reject a
    // duplicate, so just try a new random code if that happens.
    while (attempts < 5) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { referralCode: code },
        });
        console.log(`  #${user.id} ${user.email} -> ${code}`);
        updated++;
        break;
      } catch (err) {
        if (err.code === "P2002") {
          code = generateCode();
          attempts++;
        } else {
          console.error(`  FAILED for #${user.id}:`, err.message);
          break;
        }
      }
    }
  }

  console.log(`\nDone. Updated ${updated}/${usersWithoutCode.length} user(s).\n`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("BACKFILL ERROR:", err);
  await prisma.$disconnect();
  process.exit(1);
});