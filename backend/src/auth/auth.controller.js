import sgMail from "@sendgrid/mail";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Simple profanity filter — no external package needed
const BANNED_WORDS = [
  "fuck", "shit", "ass", "bitch", "dick", "cock", "pussy",
  "cunt", "bastard", "nigger", "nigga", "faggot", "retard",
  "whore", "slut", "piss", "crap", "douche"
];

const isProfane = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BANNED_WORDS.some(word => lower.includes(word));
};

// REGISTER
export const register = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (isProfane(name)) {
      return res.status(400).json({ message: "Username contains inappropriate language. Please choose a different name." });
    }

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

// LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

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
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ME
export const me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profilePhoto: true,
        repPoints: true,
      },
    });

    res.json({ user });
  } catch (err) {
    console.error("ME ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE ACCOUNT
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    await prisma.notification.deleteMany({ where: { OR: [{ recipientId: userId }, { actorId: userId }] } });
    await prisma.report.deleteMany({ where: { reporterId: userId } });
    await prisma.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
    await prisma.like.deleteMany({ where: { userId } });
    await prisma.comment.deleteMany({ where: { userId } });
    await prisma.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } });
    await prisma.bid.deleteMany({ where: { mechanicId: userId } });
    await prisma.review.deleteMany({ where: { OR: [{ reviewerId: userId }, { mechanicId: userId }] } });
    await prisma.log.deleteMany({ where: { userId } });
    await prisma.vehicle.deleteMany({ where: { userId } });
    await prisma.post.deleteMany({ where: { userId } });
    await prisma.job.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE ACCOUNT ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// FORGOT PASSWORD
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ message: "If that email exists, a reset link has been sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await prisma.user.update({
      where: { email },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    });

    const resetLink = `autoai://reset-password?token=${token}`;

    await sgMail.send({
      to: email,
      from: "maz@amazmade.com",
      subject: "Reset Your AutoAI Password 🔧",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #050509; color: white; padding: 32px; border-radius: 16px;">
          <h2 style="color: #345bff;">AutoAI™</h2>
          <p>You requested a password reset. Tap the button below to set a new password.</p>
          <p>This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetLink}" style="display: inline-block; background: #345bff; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; margin: 20px 0;">
            Reset My Password
          </a>
          <p style="color: #6b7280; font-size: 13px;">If you didn't request this, ignore this email. Your password won't change.</p>
        </div>
      `,
    });

    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// RESET PASSWORD
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset link." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({ message: "Password reset successfully!" });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// CHANGE PASSWORD (logged in)
export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({ message: "Password changed successfully!" });
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};