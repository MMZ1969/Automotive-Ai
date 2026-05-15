import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";

// GET /users/me
export async function getMe(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        repPoints: true,
        profilePhoto: true,
        phone: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("GET ME ERROR:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
}

// PUT /users/me
export async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { email, name, password } = req.body;

    const data = {};

    if (name) data.name = name;
    if (req.body.phone !== undefined) data.phone = req.body.phone;
    if (req.body.role !== undefined) data.role = req.body.role;
    if (req.body.profilePhoto !== undefined) data.profilePhoto = req.body.profilePhoto;


    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== userId) {
        return res.status(400).json({ error: "Email already in use" });
      }
      data.email = email;
    }

    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      data.password = hashed;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
      id: true,
      email: true,
      name: true,
      role: true,
      profilePhoto: true,
      phone: true,
      repPoints: true,  
      createdAt: true,
},
    });

    res.json(updated);
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
}

// GET /users/search?q=query
export async function searchUsers(req, res) {
  try {
    const { q } = req.query;
    const currentUserId = req.user.id;

    if (!q || q.trim() === "") {
      return res.json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } },
          {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profilePhoto: true,
        _count: {
          select: {
            followers: true,
            posts: true,
          },
        },
      },
      take: 20,
    });

    res.json(users);
  } catch (err) {
    console.error("SEARCH USERS ERROR:", err);
    res.status(500).json({ error: "Failed to search users" });
  }
}

// GET /users/leaderboard?role=DIYER|MECHANIC
export async function getLeaderboard(req, res) {
  try {
    const { role } = req.query;

    const users = await prisma.user.findMany({
      where: role ? { role: role.toUpperCase() } : {},
      orderBy: { repPoints: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        role: true,
        profilePhoto: true,
        repPoints: true,
        _count: {
          select: {
            posts: true,
            followers: true,
          },
        },
      },
    });

    res.json(users);
  } catch (err) {
    console.error("GET LEADERBOARD ERROR:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
}
// GET /users/:id/profile
export async function getUserProfile(req, res) {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        role: true,
        profilePhoto: true,
        repPoints: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("GET USER PROFILE ERROR:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
}
// POST /users/push-token
export async function savePushToken(req, res) {
  try {
    const userId = req.user.id;
    const { pushToken } = req.body;

    await prisma.user.update({
      where: { id: userId },
      data: { pushToken },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("SAVE PUSH TOKEN ERROR:", err);
    res.status(500).json({ error: "Failed to save push token" });
  }
}
// POST /users/:id/block
export async function blockUser(req, res) {
  try {
    const blockerId = req.user.id;
    const blockedId = Number(req.params.id);

    if (blockerId === blockedId) {
      return res.status(400).json({ error: "You cannot block yourself" });
    }

    const existing = await prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });

    if (existing) {
      await prisma.block.delete({
        where: { blockerId_blockedId: { blockerId, blockedId } },
      });
      return res.json({ blocked: false });
    } else {
      await prisma.block.create({
        data: { blockerId, blockedId },
      });
      return res.json({ blocked: true });
    }
  } catch (err) {
    console.error("BLOCK USER ERROR:", err);
    res.status(500).json({ error: "Failed to block user" });
  }
}

// GET /users/blocked
export async function getBlockedUsers(req, res) {
  try {
    const blocks = await prisma.block.findMany({
      where: { blockerId: req.user.id },
      include: {
        blocked: {
          select: { id: true, name: true, profilePhoto: true },
        },
      },
    });
    res.json(blocks.map((b) => b.blocked));
  } catch (err) {
    console.error("GET BLOCKED USERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch blocked users" });
  }
}
// GET /users/:id/mechanic-stats
export async function getMechanicStats(req, res) {
  try {
    const id = Number(req.params.id);

    const completedJobs = await prisma.job.count({
      where: {
        acceptedBidId: { not: null },
        status: "COMPLETED",
        bids: {
          some: {
            mechanicId: id,
            status: "ACCEPTED",
          },
        },
      },
    });

    const reviews = await prisma.review.findMany({
      where: { mechanicId: id },
      select: { rating: true },
    });

    const avgRating = reviews.length
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

    const totalBids = await prisma.bid.count({
      where: { mechanicId: id },
    });

    const acceptedBids = await prisma.bid.count({
      where: { mechanicId: id, status: "ACCEPTED" },
    });

    const winRate = totalBids > 0
      ? Math.round((acceptedBids / totalBids) * 100)
      : 0;

    res.json({
      completedJobs,
      avgRating,
      totalReviews: reviews.length,
      winRate,
    });
  } catch (err) {
    console.error("GET MECHANIC STATS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch mechanic stats" });
  }
}
// GET /users/:id/followers
export async function getFollowers(req, res) {
  try {
    const id = Number(req.params.id);
    const follows = await prisma.follow.findMany({
      where: { followingId: id },
      include: {
        follower: {
          select: { id: true, name: true, role: true, profilePhoto: true },
        },
      },
    });
    res.json(follows.map((f) => f.follower));
  } catch (err) {
    console.error("GET FOLLOWERS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch followers" });
  }
}

// GET /users/:id/following
export async function getFollowing(req, res) {
  try {
    const id = Number(req.params.id);
    const follows = await prisma.follow.findMany({
      where: { followerId: id },
      include: {
        following: {
          select: { id: true, name: true, role: true, profilePhoto: true },
        },
      },
    });
    res.json(follows.map((f) => f.following));
  } catch (err) {
    console.error("GET FOLLOWING ERROR:", err);
    res.status(500).json({ error: "Failed to fetch following" });
  }
}