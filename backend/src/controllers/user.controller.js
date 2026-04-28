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