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

    // Update name
    if (name) data.name = name;

    // Update email (must check if taken)
    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== userId) {
        return res.status(400).json({ error: "Email already in use" });
      }
      data.email = email;
    }

    // Update password (must hash)
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