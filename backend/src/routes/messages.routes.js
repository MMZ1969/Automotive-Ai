import express from "express";
import prisma from "../lib/prisma.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// GET all conversations for current user
router.get("/conversations", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      orderBy: { updatedAt: "desc" },
      include: {
        user1: { select: { id: true, name: true, profilePhoto: true, role: true, isVerified: true } },
        user2: { select: { id: true, name: true, profilePhoto: true, role: true, isVerified: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    // Count unread per conversation
    const withUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            receiverId: userId,
            read: false,
          },
        });
        return { ...conv, unreadCount };
      })
    );

    res.json(withUnread);
  } catch (err) {
    console.error("GET CONVERSATIONS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// GET or CREATE conversation with a specific user
router.post("/conversations", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { otherUserId } = req.body;

    if (!otherUserId) return res.status(400).json({ error: "otherUserId is required" });
    if (otherUserId === userId) return res.status(400).json({ error: "Cannot message yourself" });

    const user1Id = Math.min(userId, otherUserId);
    const user2Id = Math.max(userId, otherUserId);

    let conversation = await prisma.conversation.findUnique({
      where: { user1Id_user2Id: { user1Id, user2Id } },
      include: {
        user1: { select: { id: true, name: true, profilePhoto: true, role: true, isVerified: true } },
        user2: { select: { id: true, name: true, profilePhoto: true, role: true, isVerified: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { user1Id, user2Id },
        include: {
          user1: { select: { id: true, name: true, profilePhoto: true, role: true, isVerified: true } },
          user2: { select: { id: true, name: true, profilePhoto: true, role: true, isVerified: true } },
          messages: { orderBy: { createdAt: "asc" } },
        },
      });
    }

    res.json(conversation);
  } catch (err) {
    console.error("GET/CREATE CONVERSATION ERROR:", err);
    res.status(500).json({ error: "Failed to get or create conversation" });
  }
});

// GET messages for a conversation
router.get("/conversations/:id/messages", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = parseInt(req.params.id);

    // Verify user is part of this conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Mark messages as read
    await prisma.message.updateMany({
      where: { conversationId, receiverId: userId, read: false },
      data: { read: true },
    });

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, name: true, profilePhoto: true } },
      },
    });

    res.json(messages);
  } catch (err) {
    console.error("GET MESSAGES ERROR:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// POST send a message
router.post("/conversations/:id/messages", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    // Verify user is part of this conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const receiverId = conversation.user1Id === userId ? conversation.user2Id : conversation.user1Id;

    // Check if either user has blocked the other
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: receiverId },
          { blockerId: receiverId, blockedId: userId },
        ],
      },
    });
    if (block) {
      return res.status(403).json({ error: "Cannot send message — user is blocked" });
    }

    const message = await prisma.message.create({
      data: { conversationId, senderId: userId, receiverId, content },
      include: {
        sender: { select: { id: true, name: true, profilePhoto: true } },
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // ── Push the message to the recipient's phone ──
    // Uses sendPushNotification directly (NOT createAndSendNotification),
    // so messages push WITHOUT creating a bell notification — keeps the
    // bell = alerts / Profile = messages split intact.
    try {
      const recipient = await prisma.user.findUnique({
        where: { id: receiverId },
        select: { pushToken: true },
      });

      if (recipient?.pushToken) {
        // Badge = recipient's total unread messages
        const unreadCount = await prisma.message.count({
          where: { receiverId, read: false },
        });

        await sendPushNotification(
          recipient.pushToken,
          `${message.sender.name} 💬`,
          content.length > 80 ? content.slice(0, 80) + "…" : content,
          unreadCount
        );
      }
    } catch (pushErr) {
      console.error("MESSAGE PUSH ERROR:", pushErr);
    }

    res.status(201).json(message);
  } catch (err) {
    console.error("SEND MESSAGE ERROR:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// GET unread message count
router.get("/unread-count", authMiddleware, async (req, res) => {
  try {
    const count = await prisma.message.count({
      where: { receiverId: req.user.id, read: false },
    });
    res.json({ count });
  } catch (err) {
    console.error("UNREAD COUNT ERROR:", err);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

// DELETE a conversation (and its messages)
router.delete("/conversations/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = parseInt(req.params.id);

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await prisma.message.deleteMany({ where: { conversationId } });
    await prisma.conversation.delete({ where: { id: conversationId } });

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE CONVERSATION ERROR:", err);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

export default router;