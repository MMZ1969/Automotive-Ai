import prisma from "../lib/prisma.js";

// GET /api/parts — browse all available parts
export async function getParts(req, res) {
  try {
    const { category } = req.query;

    const parts = await prisma.part.findMany({
      where: {
        status: "AVAILABLE",
        ...(category && category !== "All" ? { category } : {}),
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
    const { title, description, category, condition, price, priceType, imageUrl } = req.body;

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
        price: price ? parseFloat(price) : null,
        priceType: priceType || "FIXED",
        imageUrl,
      },
    });

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
    const { title, description, category, condition, price, priceType, imageUrl, status } = req.body;

    const existing = await prisma.part.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const updated = await prisma.part.update({
      where: { id },
      data: { title, description, category, condition, price, priceType, imageUrl, status },
    });

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
    if (!existing || existing.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await prisma.part.delete({ where: { id } });
    res.json({ message: "Listing deleted" });
  } catch (err) {
    console.error("DELETE PART ERROR:", err);
    res.status(500).json({ error: "Failed to delete listing" });
  }
}