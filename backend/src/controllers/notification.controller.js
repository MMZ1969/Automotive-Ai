import prisma from "../lib/prisma.js";
import { isTestAccountUser } from "../lib/testAccounts.js";

// Helper function to send push notification.
// badgeCount null = leave the app badge alone. data rides along to the app
// (e.g. { type: "REMINDER", vehicleId } so a tap opens that vehicle).
//
// Reads Expo's ticket and, 20 s later, the delivery receipt, and logs every
// failure as "PUSH FAIL | ...". Before 11/22 the response was never read, so a
// rejected push (stale token, bad APNs/FCM credentials) left no trace.
// Successes log one short "PUSH OK" line. Never throws.
export async function sendPushNotification(pushToken, title, body, badgeCount = 1, data = undefined) {
  if (!pushToken || !pushToken.startsWith("ExponentPushToken")) {
    if (pushToken) console.warn(`PUSH SKIP | not an Expo token | ${String(pushToken).slice(0, 20)}…`);
    return;
  }
  const tok = pushToken.slice(18, 30); // short id for logs, not the full token

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        sound: "default",
        priority: "high",
        channelId: "default", // the app creates this channel (lib/push.ts)
        ...(typeof badgeCount === "number" ? { badge: badgeCount } : {}),
        ...(data ? { data } : {}),
      }),
    });
    const json = await res.json().catch(() => null);
    const ticket = Array.isArray(json?.data) ? json.data[0] : json?.data;

    if (!res.ok || !ticket || ticket.status !== "ok") {
      console.error(
        `PUSH FAIL | ticket | tok=${tok} | http=${res.status} | ` +
          `${ticket?.details?.error || ticket?.message || JSON.stringify(json?.errors || json)}`
      );
      return;
    }
    console.log(`PUSH OK | tok=${tok} | "${String(title).slice(0, 30)}"`);

    // The ticket only means Expo queued it; Apple/Google errors show up in the receipt.
    setTimeout(() => checkPushReceipt(ticket.id, tok), 20000).unref?.();
  } catch (err) {
    console.error("PUSH NOTIFICATION ERROR:", err);
  }
}

async function checkPushReceipt(ticketId, tok) {
  try {
    const rr = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [ticketId] }),
    });
    const receipt = (await rr.json().catch(() => null))?.data?.[ticketId];
    if (receipt && receipt.status !== "ok") {
      console.error(`PUSH FAIL | receipt | tok=${tok} | ${receipt.details?.error || ""} ${receipt.message || ""}`);
    }
  } catch (err) {
    console.error("PUSH RECEIPT ERROR:", err?.message || err);
  }
}

// GET /api/notifications — get all notifications for logged in user
export async function getNotifications(req, res) {
  try {
    const notifications = await prisma.notification.findMany({
      where: { recipientId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            profilePhoto: true,
          },
        },
      },
    });

    res.json(notifications);
  } catch (err) {
    console.error("GET NOTIFICATIONS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
}

// GET /api/notifications/unread-count
export async function getUnreadCount(req, res) {
  try {
    const count = await prisma.notification.count({
      where: {
        recipientId: req.user.id,
        read: false,
      },
    });

    res.json({ count });
  } catch (err) {
    console.error("GET UNREAD COUNT ERROR:", err);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
}

// POST /api/notifications/mark-read — mark all as read
export async function markAllRead(req, res) {
  try {
    await prisma.notification.updateMany({
      where: {
        recipientId: req.user.id,
        read: false,
      },
      data: { read: true },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("MARK READ ERROR:", err);
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
}

// Helper exported for use in other controllers
export async function createAndSendNotification({ recipientId, actorId, type, postId, jobId, message }) {
  try {
    // Never notify a real user about activity from a test/reviewer account —
    // covers likes, comments, replies, follows, and car show RSVPs, since
    // every one of those funnels through this single function.
    if (actorId && (await isTestAccountUser(actorId))) return;

    await prisma.notification.create({
      data: {
        recipientId,
        actorId,
        type,
        postId: postId || null,
        jobId: jobId || null,
        message,
      },
    });

    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { pushToken: true },
    });

    if (recipient?.pushToken) {
      // Get actual unread count for the badge
      const unreadCount = await prisma.notification.count({
        where: { recipientId, read: false },
      });

      await sendPushNotification(
        recipient.pushToken,
        "AutoAI 🚗",
        message,
        unreadCount
      );
    }
  } catch (err) {
    console.error("CREATE NOTIFICATION ERROR:", err);
  }
}

// DELETE /api/notifications/:id — delete a single notification
export async function deleteNotification(req, res) {
  try {
    const id = Number(req.params.id);

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) return res.status(404).json({ error: "Notification not found" });
    if (notification.recipientId !== req.user.id) return res.status(403).json({ error: "Not authorized" });

    await prisma.notification.delete({ where: { id } });

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE NOTIFICATION ERROR:", err);
    res.status(500).json({ error: "Failed to delete notification" });
  }
}

// DELETE /api/notifications — clear all notifications for the user
export async function deleteAllNotifications(req, res) {
  try {
    await prisma.notification.deleteMany({
      where: { recipientId: req.user.id },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE ALL NOTIFICATIONS ERROR:", err);
    res.status(500).json({ error: "Failed to clear notifications" });
  }
}
