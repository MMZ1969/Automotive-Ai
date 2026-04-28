// src/server.js
import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import authRoutes from "./auth/auth.routes.js";
import followRoutes from "./routes/follow.routes.js";
import logsRoutes from "./routes/logs.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import postsRoutes from "./routes/posts.js";
import uploadRoutes from "./routes/upload.js";
import userRoutes from "./routes/user.routes.js";
import vehiclesRoutes from "./routes/vehicles.routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/users", followRoutes);
app.use("/api/vehicles", vehiclesRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/notifications", notificationRoutes);

// AI Diagnosis route
app.post("/api/diagnose", async (req, res) => {
  try {
    const { query } = req.body;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `You are an expert automotive mechanic and diagnostician. A user has described a car problem. Analyze it and provide:

1. Most likely causes (top 3)
2. Severity level (Low/Medium/High/Critical)
3. Estimated repair cost range
4. DIY difficulty (Easy/Medium/Hard/Professional Only)
5. Immediate action needed
6. Step by step diagnosis tips

User's problem: "${query}"

Respond in JSON format only, no markdown, like this:
{
  "summary": "brief one line summary",
  "severity": "Low|Medium|High|Critical",
  "causes": ["cause 1", "cause 2", "cause 3"],
  "estimatedCost": "$X - $Y",
  "diyDifficulty": "Easy|Medium|Hard|Professional Only",
  "immediateAction": "what to do right now",
  "diagnosisSteps": ["step 1", "step 2", "step 3"],
  "proTip": "one expert tip"
}`
          }
        ],
      }),
    });

    const data = await response.json();
    console.log("ANTHROPIC RESPONSE:", JSON.stringify(data));
    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: "AI service error", details: data });
    }
    const text = data.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "Invalid AI response" });
    }
    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    console.error("DIAGNOSE ERROR:", err);
    res.status(500).json({ error: "Failed to diagnose" });
  }
});

// YouTube Search route
app.get("/api/youtube", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.json([]);

    const searchQuery = encodeURIComponent(`${query} car repair how to fix`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&maxResults=5&key=${process.env.YOUTUBE_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    const videos = data.items?.map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium.url,
      channel: item.snippet.channelTitle,
    })) || [];

    res.json(videos);
  } catch (err) {
    console.error("YOUTUBE ERROR:", err);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});