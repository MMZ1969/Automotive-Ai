import { prisma } from "../lib/prisma.js";

export const getCurrentUser = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  } catch (err) {
    console.error("ME_SERVICE_ERROR", err);
    throw new Error("Failed to load user");
  }
};