import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { REFRESH_AFTER_SECONDS, signToken } from "../lib/authToken.js";

const LAST_SEEN_THROTTLE_MS = 15 * 60 * 1000;

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
    // an already-issued token.
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { isBanned: true, lastSeenAt: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: "This account has been banned." });
    }

    // Record "last seen" at most every 15 minutes, fire-and-forget so it
    // never slows down or fails the request.
    const now = Date.now();
    if (!user.lastSeenAt || now - user.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
      prisma.user
        .update({ where: { id: decoded.userId }, data: { lastSeenAt: new Date(now) } })
        .catch((e) => console.error("LAST SEEN UPDATE ERROR:", e.message));
    }

    // Sliding session: a token more than a day old gets swapped for a fresh
    // 90-day one. Role comes from the DB so a role change sticks too.
    // Builds that don't read this header just ignore it.
    const ageSeconds = Math.floor(now / 1000) - (decoded.iat || 0);
    if (ageSeconds > REFRESH_AFTER_SECONDS) {
      res.setHeader("X-Refreshed-Token", signToken({ id: decoded.userId, role: user.role }));
    }

    req.user = { id: decoded.userId, role: decoded.role };
    next();
  } catch (err) {
    console.error("AUTH MIDDLEWARE ERROR:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}