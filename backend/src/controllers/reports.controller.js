// src/controllers/reports.controller.js
// Admin-only moderation of user reports (posts and jobs).
import prisma from "../lib/prisma.js";

const ACTIONS = [
  "DISMISS",            // report is unfounded; nothing happens to the content
  "REMOVE_CONTENT",     // delete the reported post
  "REMOVE_AND_BAN_OWNER", // delete the reported post and ban its author
  "BAN_OWNER",          // ban the author of the reported post/job, leave content
  "BAN_REPORTER",       // report looks abusive/bot-made: dismiss it and ban the reporter
];

class ModerationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function requireAdmin(req, res) {
  const admin = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { isAdmin: true },
  });
  if (!admin?.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

// Ban (never toggle) a user inside a transaction. Admins and the acting admin
// are protected so a bad click can't lock everyone out.
async function banInTx(tx, userId, adminId) {
  if (!userId) throw new ModerationError(400, "No user to ban for this report");
  if (userId === adminId) throw new ModerationError(400, "You can't ban yourself");
  const target = await tx.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!target) throw new ModerationError(404, "User not found");
  if (target.isAdmin) throw new ModerationError(400, "Can't ban an admin account");
  await tx.user.update({ where: { id: userId }, data: { isBanned: true } });
}

// GET /api/admin/reports?status=open|resolved   (default open)
export async function listReports(req, res) {
  try {
    if (!(await requireAdmin(req, res))) return;

    const resolved = req.query.status === "resolved";
    const reports = await prisma.report.findMany({
      where: { status: resolved ? { not: "OPEN" } : "OPEN" },
      orderBy: resolved ? { resolvedAt: "desc" } : { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        reason: true,
        createdAt: true,
        status: true,
        resolution: true,
        resolvedAt: true,
        targetOwnerId: true,
        targetSnapshot: true,
        reporter: {
          select: {
            id: true, name: true, email: true, emailVerified: true, isBanned: true, createdAt: true,
            _count: { select: { reports: true } },
          },
        },
        post: {
          select: {
            id: true, content: true, imageUrl: true, createdAt: true,
            user: { select: { id: true, name: true, email: true, isBanned: true, isAdmin: true } },
          },
        },
        job: {
          select: {
            id: true, title: true, description: true, status: true,
            poster: { select: { id: true, name: true, email: true, isBanned: true, isAdmin: true } },
          },
        },
      },
    });

    res.json(reports);
  } catch (err) {
    console.error("LIST REPORTS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
}

// GET /api/admin/reports/open-count
export async function getOpenReportCount(req, res) {
  try {
    if (!(await requireAdmin(req, res))) return;
    const count = await prisma.report.count({ where: { status: "OPEN" } });
    res.json({ count });
  } catch (err) {
    console.error("OPEN REPORT COUNT ERROR:", err);
    res.status(500).json({ error: "Failed to count reports" });
  }
}

// POST /api/admin/reports/:id/resolve   body: { action }
export async function resolveReport(req, res) {
  try {
    if (!(await requireAdmin(req, res))) return;

    const adminId = req.user.id;
    const reportId = Number(req.params.id);
    const { action } = req.body;

    if (!ACTIONS.includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        post: { select: { id: true, content: true, userId: true } },
        job: { select: { id: true, userId: true } },
      },
    });
    if (!report) return res.status(404).json({ error: "Report not found" });
    if (report.status !== "OPEN") {
      return res.status(400).json({ error: "This report has already been handled" });
    }

    const ownerId = report.post?.userId ?? report.job?.userId ?? null;
    const removesContent = action === "REMOVE_CONTENT" || action === "REMOVE_AND_BAN_OWNER";

    if (removesContent && !report.post) {
      return res.status(400).json({
        error: "Removing jobs isn't supported here — dismiss the report or ban the poster instead.",
      });
    }

    const now = new Date();
    const closeFields = (resolution, status = "RESOLVED") => ({
      status,
      resolution,
      resolvedAt: now,
      resolvedById: adminId,
    });

    await prisma.$transaction(async (tx) => {
      if (removesContent) {
        const postId = report.post.id;
        const resolution = action === "REMOVE_AND_BAN_OWNER" ? "POST_REMOVED_OWNER_BANNED" : "POST_REMOVED";
        const keep = { targetOwnerId: ownerId, targetSnapshot: report.post.content, postId: null };

        if (action === "REMOVE_AND_BAN_OWNER") await banInTx(tx, ownerId, adminId);

        // The Report -> Post foreign key means every report on this post has to
        // let go of it before the post can be deleted. Open ones get closed with
        // this resolution; already-closed ones keep their earlier outcome but
        // retain the post text so the history still makes sense.
        await tx.report.updateMany({ where: { postId, status: "OPEN" }, data: { ...closeFields(resolution), ...keep } });
        await tx.report.updateMany({ where: { postId }, data: keep });

        await tx.like.deleteMany({ where: { OR: [{ postId }, { comment: { postId } }] } });
        await tx.comment.deleteMany({ where: { postId } });
        await tx.post.delete({ where: { id: postId } });
        return;
      }

      if (action === "BAN_OWNER") {
        await banInTx(tx, ownerId, adminId);
        await tx.report.update({ where: { id: reportId }, data: closeFields("OWNER_BANNED") });
        return;
      }

      if (action === "BAN_REPORTER") {
        await banInTx(tx, report.reporterId, adminId);
        await tx.report.update({ where: { id: reportId }, data: closeFields("REPORTER_BANNED", "DISMISSED") });
        return;
      }

      // DISMISS
      await tx.report.update({ where: { id: reportId }, data: closeFields("DISMISSED", "DISMISSED") });
    });

    res.json({ success: true });
  } catch (err) {
    if (err instanceof ModerationError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("RESOLVE REPORT ERROR:", err);
    res.status(500).json({ error: "Failed to resolve report" });
  }
}
