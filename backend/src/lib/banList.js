// src/lib/banList.js
// One way to ban/unban a user so the signup ban list (BannedEmail) always
// matches: a banned account's email is on the list, an unbanned one's isn't.
// Matters when a banned account is later deleted: the list keeps the address
// from simply signing up again (register() checks it, alias-normalized).
//
// `db` can be the prisma client or a transaction (tx).

export async function setUserBanned(db, user, banned, reason = "Banned in app") {
  await db.user.update({ where: { id: user.id }, data: { isBanned: banned } });
  if (!user.email) return;
  const email = user.email.toLowerCase().trim();
  if (banned) {
    await db.bannedEmail.upsert({
      where: { email },
      update: {},
      create: { email, reason },
    });
  } else {
    await db.bannedEmail.deleteMany({ where: { email: { equals: email, mode: "insensitive" } } });
  }
}
