// src/services/comment.service.js
import prisma from "../lib/prisma.js";

// keep the rest of your comment service logic exactly as-is
export const createComment = async (postId, userId, content) => {
  return prisma.comment.create({
    data: {
      content,
      postId: Number(postId),
      userId,
    },
    include: {
      user: true,
    },
  });
};

export const getCommentsForPost = async (postId) => {
  return prisma.comment.findMany({
    where: { postId: Number(postId) },
    orderBy: { createdAt: "desc" },
    include: {
      user: true,
    },
  });
};