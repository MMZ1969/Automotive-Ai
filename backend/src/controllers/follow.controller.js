import prisma from "../lib/prisma.js";

// TOGGLE FOLLOW
export const toggleFollow = async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = Number(req.params.id);

    if (!followingId || isNaN(followingId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    if (followerId === followingId) {
      return res.status(400).json({ error: "You cannot follow yourself" });
    }

    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId },
      },
    });

    if (existing) {
      await prisma.follow.delete({
        where: {
          followerId_followingId: { followerId, followingId },
        },
      });
      return res.json({ following: false });
    } else {
      await prisma.follow.create({
        data: { followerId, followingId },
      });
      return res.json({ following: true });
    }
  } catch (err) {
    console.error("TOGGLE FOLLOW ERROR:", err);
    res.status(500).json({ error: "Failed to toggle follow" });
  }
};

// GET FOLLOW STATUS
export const getFollowStatus = async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = Number(req.params.id);

    if (!followingId || isNaN(followingId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId },
      },
    });

    const followerCount = await prisma.follow.count({
      where: { followingId },
    });

    const followingCount = await prisma.follow.count({
      where: { followerId: followingId },
    });

    res.json({
      following: !!follow,
      followerCount,
      followingCount,
    });
  } catch (err) {
    console.error("GET FOLLOW STATUS ERROR:", err);
    res.status(500).json({ error: "Failed to get follow status" });
  }
};