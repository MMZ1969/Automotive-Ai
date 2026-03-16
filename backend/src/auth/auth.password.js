import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    return res
      .status(200)
      .json({ message: "If that email exists, a reset link was sent." });
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res
      .status(500)
      .json({ message: "Unable to send reset link. Please try again." });
  }
};

export const resetPassword = async (req, res) => {
  try {
    return res.status(200).json({
      message: "If the reset link is valid, the password has been updated.",
    });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res
      .status(500)
      .json({ message: "Unable to reset password. Please try again." });
  }
};

export const changePassword = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new password are required" });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res
        .status(400)
        .json({ message: "Current password is incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("changePassword error:", err);
    return res
      .status(500)
      .json({ message: "Error changing password. Please try again." });
  }
};