import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

export default async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check ban status on every request, not just at login — this is
    // what makes a ban take effect immediately instead of waiting out
    // an already-issued 7-day token.
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { isBanned: true },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: "This account has been banned." });
    }

    req.user = { id: decoded.userId, role: decoded.role };
    next();
  } catch (err) {
    console.error("AUTH MIDDLEWARE ERROR:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}