// src/controllers/diagnoses.controller.js
// Admin-only view of DiagnosisLog: what people are asking the AI.
import prisma from "../lib/prisma.js";
import { TEST_ACCOUNT_EMAILS } from "../lib/testAccounts.js";
import { requireAdmin } from "./reports.controller.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// GET /api/admin/diagnoses?days=7
// Returns { stats, items } — items newest first, max 200.
export async function listDiagnoses(req, res) {
  try {
    if (!(await requireAdmin(req, res))) return;

    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
    const since = new Date(Date.now() - days * DAY_MS);
    const realUser = { isAdmin: false, email: { notIn: TEST_ACCOUNT_EMAILS } };

    const [items, total, real, cached, repeats, distinctUsers] = await Promise.all([
      prisma.diagnosisLog.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true, query: true, vehicleLabel: true, summary: true, severity: true,
          cached: true, repAwarded: true, createdAt: true,
          user: { select: { id: true, name: true, email: true, isAdmin: true } },
        },
      }),
      prisma.diagnosisLog.count({ where: { createdAt: { gte: since } } }),
      prisma.diagnosisLog.count({ where: { createdAt: { gte: since }, user: realUser } }),
      prisma.diagnosisLog.count({ where: { createdAt: { gte: since }, cached: true } }),
      prisma.diagnosisLog.count({ where: { createdAt: { gte: since }, repAwarded: false } }),
      prisma.diagnosisLog.findMany({
        where: { createdAt: { gte: since }, user: realUser },
        distinct: ["userId"],
        select: { userId: true },
      }),
    ]);

    res.json({
      stats: { days, total, fromRealUsers: real, realUsers: distinctUsers.length, cached, repeatsNoRep: repeats },
      items: items.map((d) => ({
        ...d,
        user: { ...d.user, isTest: TEST_ACCOUNT_EMAILS.includes(d.user.email) },
      })),
    });
  } catch (err) {
    console.error("LIST DIAGNOSES ERROR:", err);
    res.status(500).json({ error: "Failed to fetch diagnoses" });
  }
}
