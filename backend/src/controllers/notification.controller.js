import prisma from "../lib/prisma.js";

// Helper function to send push notification
async function sendPushNotification(pushToken, title, body) {
  if (!pushToken || !pushToken.startsWith("ExponentPushToken")) return;

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        sound: "default",
        badge: 1,
      }),
    });
  } catch (err) {
    console.error("PUSH NOTIFICATION ERROR:", err);
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
export async function createAndSendNotification({ recipientId, actorId, type, postId, message }) {
  try {
    // Create notification in database
    await prisma.notification.create({
      data: {
        recipientId,
        actorId,
        type,
        postId: postId || null,
        message,
      },
    });

    // Get recipient's push token
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { pushToken: true, name: true },
    });

    if (recipient?.pushToken) {
      await sendPushNotification(
        recipient.pushToken,
        "AutoAI 🚗",
        message
      );
    }
  } catch (err) {
    console.error("CREATE NOTIFICATION ERROR:", err);
  }
}