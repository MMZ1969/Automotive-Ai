import prisma from '../lib/prisma.js';
export async function getUserById(id) {
  return prisma.user.findUnique({
    where: { id },
  });
}

export async function updateUser(id, data) {
  return prisma.user.update({
    where: { id },
    data,
  });
}