// purge-test-content.js
// Wipes all CONTENT (posts, comments, likes, follows, etc.) created by your
// store-review test accounts, while KEEPING the accounts themselves — Apple and
// Google both need them to log in for future review/pre-launch runs.
//
// DRY RUN by default: it only reports what it WOULD delete and changes nothing.
// Add --live to actually delete.
//
//   cd C:\automotive-ai\backend; node purge-test-content.js          (dry run — safe)
//   cd C:\automotive-ai\backend; node purge-test-content.js --live   (real delete)

import prisma from "./src/lib/prisma.js";

// 👇 Accounts whose CONTENT to wipe. The accounts themselves are KEPT.
const TEST_ACCOUNT_EMAILS = [
  "test@google.com",   // Google pre-launch / review bot — KEEP account, purge its content
  "apple@test.com",    // Apple reviewer — KEEP account, purge its content

  // ⚠️ UNCERTAIN — you think these are your paid Google testing group.
  // The DRY RUN is 100% safe (deletes nothing), so leave them in to INSPECT what they have.
  // BEFORE the --live run: if they're active testers you want to keep, DELETE these two lines.
  "john.doe@example.com",
  "testuser@example.com",
];

const LIVE = process.argv.includes("--live");

async function main() {
  console.log(LIVE
    ? "=== LIVE RUN: content WILL be deleted (accounts preserved) ==="
    : "=== DRY RUN: nothing will be deleted ===");

  const users = await prisma.user.findMany({
    where: { email: { in: TEST_ACCOUNT_EMAILS } },
    select: { id: true, email: true },
  });

  if (users.length === 0) {
    console.log("\nNo matching test accounts found. Check the emails in TEST_ACCOUNT_EMAILS.");
    return;
  }

  for (const user of users) {
    const userId = user.id;
    console.log(`\n--- ${user.email} (id=${userId}) ---`);

    // This account's posts — we need their IDs to clear other people's engagement on them
    const posts = await prisma.post.findMany({ where: { userId }, select: { id: true } });
    const postIds = posts.map((p) => p.id);

    // Report the blast radius
    console.log(`  posts authored:            ${postIds.length}`);
    console.log(`  comments by this account:  ${await prisma.comment.count({ where: { userId } })}`);
    console.log(`  likes by this account:     ${await prisma.like.count({ where: { userId } })}`);
    console.log(`  comments on their posts:   ${postIds.length ? await prisma.comment.count({ where: { postId: { in: postIds } } }) : 0}`);
    console.log(`  likes on their posts:      ${postIds.length ? await prisma.like.count({ where: { postId: { in: postIds } } }) : 0}`);
    console.log(`  follows:                   ${await prisma.follow.count({ where: { OR: [{ followerId: userId }, { followingId: userId }] } })}`);
    console.log(`  parts:                     ${await prisma.part.count({ where: { userId } })}`);
    console.log(`  car shows:                 ${await prisma.carShow.count({ where: { userId } })}`);

    if (!LIVE) continue;

    // ---- DELETE in cascade-safe order: children before parents ----

    // 1. Everyone's engagement ON this account's posts (so the posts become deletable)
    if (postIds.length) {
      await prisma.like.deleteMany({ where: { postId: { in: postIds } } });
      await prisma.report.deleteMany({ where: { postId: { in: postIds } } });
      await prisma.comment.deleteMany({ where: { postId: { in: postIds }, parentId: { not: null } } }); // replies first
      await prisma.comment.deleteMany({ where: { postId: { in: postIds } } });
    }

    // 2. This account's own activity scattered across the app
    await prisma.carShowAttendee.deleteMany({ where: { userId } });
    await prisma.carShow.deleteMany({ where: { userId } });
    await prisma.message.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } });
    await prisma.conversation.deleteMany({ where: { OR: [{ user1Id: userId }, { user2Id: userId }] } });
    await prisma.part.deleteMany({ where: { userId } });
    await prisma.notification.deleteMany({ where: { OR: [{ recipientId: userId }, { actorId: userId }] } });
    await prisma.report.deleteMany({ where: { reporterId: userId } });
    await prisma.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
    await prisma.like.deleteMany({ where: { userId } });
    await prisma.comment.deleteMany({ where: { userId, parentId: { not: null } } }); // replies first
    await prisma.comment.deleteMany({ where: { userId } });
    await prisma.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } });
    await prisma.bid.deleteMany({ where: { OR: [{ mechanicId: userId }, { job: { userId } }] } });
    await prisma.review.deleteMany({ where: { OR: [{ reviewerId: userId }, { mechanicId: userId }] } });
    await prisma.log.deleteMany({ where: { userId } });
    await prisma.vehicle.deleteMany({ where: { userId } });

    // 3. Finally the posts and jobs themselves (now childless)
    await prisma.post.deleteMany({ where: { userId } });
    await prisma.job.deleteMany({ where: { userId } });

    console.log(`  ✅ Content cleaned for ${user.email} — account kept.`);
  }

  console.log(LIVE
    ? "\n=== LIVE RUN complete. Test accounts preserved. ==="
    : "\n=== DRY RUN complete. Nothing changed. Re-run with --live to delete. ===");
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });