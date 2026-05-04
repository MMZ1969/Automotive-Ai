import { Filter } from "bad-words";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

const filter = new Filter();

// REGISTER
export const register = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // Check for inappropriate username
    if (filter.isProfane(name)) {
      return res.status(400).json({ message: "Username contains inappropriate language. Please choose a different name." });
    }

    // Username length check
    if (!name || name.trim().length < 2 || name.trim().length > 30) {
      return res.status(400).json({ message: "Username must be between 2 and 30 characters." });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || "DIYER",
      },
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        profilePhoto: user.profilePhoto,
        repPoints: user.repPoints,
      },
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};