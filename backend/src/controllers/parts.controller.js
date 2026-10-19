import prisma from "../lib/prisma.js";
import { hideTestAccountsExceptViewer } from "../lib/testAccounts.js";

const STATUSES = ["AVAILABLE", "SOLD"];
const CONTACT_PREFS = ["EMAIL", "PHONE", "BOTH"];

// undefined = field not sent (leave as is); "" / null = clear it
function parsePrice(price) {
  if (price === undefined) return undefined;
  if (price === null || price === "") return null;
  const n = parseFloat(price);
  return Number.isFinite(n) ? n : null;
}

// Keyword search over title + description. Every word must appear in one
// of them (case-insensitive), so "2014 silverado headlight" narrows
// instead of widening. Capped so a pasted paragraph can't build a huge query.
function partsSearchFilter(rawQ) {
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 80) : "";
  if (q.length < 2) return [];
  const words = q.split(/\s+/).filter((w) => w.length >= 1).slice(0, 6);
  return words.map((w) => ({
    OR: [
      { title: { contains: w, mode: "insensitive" } },
      { description: { contains: w, mode: "insensitive" } },
    ],
  }));
}

// GET /api/parts — browse all available parts
// Optional: ?category=Engine  ?q=silverado headlight  (combinable)
export async function getParts(req, res) {
  try {
    const { category, q } = req.query;

    const parts = await prisma.part.findMany({
      where: {
        status: "AVAILABLE",
        ...(category && category !== "All" ? { category } : {}),
        AND: [hideTestAccountsExceptViewer(req.user?.id), ...partsSearchFilter(q)],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profilePhoto: true,
            role: true,
            repPoints: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(parts);
  } catch (err) {
    console.error("GET PARTS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch parts" });
  }
}

// GET /api/parts/mine — get current user's listings
export async function getMyParts(req, res) {
  try {
    const userId = req.user.id;

    const parts = await prisma.part.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    res.json(parts);
  } catch (err) {
    console.error("GET MY PARTS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch your listings" });
  }
}

// GET /api/parts/:id — get single part
export async function getPartById(req, res) {
  try {
    const id = Number(req.params.id);

    const part = await prisma.part.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profilePhoto: true,
            role: true,
            repPoints: true,
            phone: true,
          },
        },
      },
    });

    if (!part) return res.status(404).json({ error: "Part not found" });
    res.json(part);
  } catch (err) {
    console.error("GET PART ERROR:", err);
    res.status(500).json({ error: "Failed to fetch part" });
  }
}

// POST /api/parts — create a listing
export async function createPart(req, res) {
  try {
    const userId = req.user.id;
    const { title, description, category, condition, price, priceType, imageUrl, contactPreference } = req.body;

    if (!title || !category || !condition) {
      return res.status(400).json({ error: "Title, category, and condition are required" });
    }

    const part = await prisma.part.create({
      data: {
        userId,
        title,
        description,
        category,
        condition,
        price: parsePrice(price) ?? null,
        priceType: priceType || "FIXED",
        imageUrl,
        ...(CONTACT_PREFS.includes(contactPreference) ? { contactPreference } : {}),
      },
    });

    // Award +1 rep for listing a part — parity with a regular post
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { repPoints: { increment: 1 } },
      });
    } catch (repErr) {
      console.error("PART LISTING REP AWARD ERROR:", repErr);
    }

    res.json(part);
  } catch (err) {
    console.error("CREATE PART ERROR:", err);
    res.status(500).json({ error: "Failed to create listing" });
  }
}

// PUT /api/parts/:id — update a listing
export async function updatePart(req, res) {
  try {
    const userId = req.user.id;
    const id = Number(req.params.id);
    const { title, description, category, condition, price, priceType, imageUrl, status, contactPreference } = req.body;

    if (title !== undefined && !String(title).trim()) {
      return res.status(400).json({ error: "Title can't be empty" });
    }
    if (status !== undefined && !STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const existing = await prisma.part.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const updated = await prisma.part.update({
      where: { id },
      data: {
        title, description, category, condition, priceType, imageUrl, status,
        price: parsePrice(price),
        ...(CONTACT_PREFS.includes(contactPreference) ? { contactPreference } : {}),
      },
    });

    // Award +5 rep the moment a listing transitions INTO "SOLD" — guarded
    // so re-saving an already-sold listing (or any other update) never
    // re-awards rep for the same sale.
    if (status === "SOLD" && existing.status !== "SOLD") {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { repPoints: { increment: 5 } },
        });
      } catch (repErr) {
        console.error("PART SOLD REP AWARD ERROR:", repErr);
      }
    }

    res.json(updated);
  } catch (err) {
    console.error("UPDATE PART ERROR:", err);
    res.status(500).json({ error: "Failed to update listing" });
  }
}

// DELETE /api/parts/:id — delete a listing
export async function deletePart(req, res) {
  try {
    const userId = req.user.id;
    const id = Number(req.params.id);

    const existing = await prisma.part.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Listing not found" });
    if (existing.userId !== userId) {
      // Admins can remove any listing (moderation, reviewer test posts)
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
      if (!me?.isAdmin) return res.status(403).json({ error: "Unauthorized" });
    }

    await prisma.part.delete({ where: { id } });
    res.json({ message: "Listing deleted" });
  } catch (err) {
    console.error("DELETE PART ERROR:", err);
    res.status(500).json({ error: "Failed to delete listing" });
  }
}