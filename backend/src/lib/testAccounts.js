import prisma from "./prisma.js";

export const TEST_ACCOUNT_EMAILS = ["test@google.com", "apple@test.com"];

// Reusable Prisma filter — spread this into any `where` clause that
// filters on a `user` relation to exclude Apple/Google reviewer accounts.
export const excludeTestAccountsFilter = {
  email: { notIn: TEST_ACCOUNT_EMAILS },
};

// For places where we only have a userId (e.g. a notification's actorId)
// and need to check membership before creating/showing something.
export async function isTestAccountUser(userId) {
  if (!userId) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return user ? TEST_ACCOUNT_EMAILS.includes(user.email) : false;
}