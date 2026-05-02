// src/server.js
import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import authRoutes from "./auth/auth.routes.js";
import followRoutes from "./routes/follow.routes.js";
import jobRoutes from "./routes/job.routes.js";
import logsRoutes from "./routes/logs.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import partsRoutes from "./routes/parts.routes.js";
import postsRoutes from "./routes/posts.js";
import reviewRoutes from "./routes/reviews.js";
import uploadRoutes from "./routes/upload.js";
import userRoutes from "./routes/user.routes.js";
import vehiclesRoutes from "./routes/vehicles.routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/users", followRoutes);
app.use("/api/vehicles", vehiclesRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/parts", partsRoutes);
app.use("/api/reviews", reviewRoutes);

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

// AI Part Analyzer route — photo → autofill listing
app.post("/api/analyze-part", async (req, res) => {
  try {
    const { imageBase64, mediaType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "No image provided" });
    }

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
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/jpeg",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: `You are an expert automotive parts identifier. Look at this image of a car part and provide listing details for someone selling it.

Respond in JSON format only, no markdown, like this:
{
  "title": "specific part name and fitment if visible (e.g. K&N Cold Air Intake for Honda Civic)",
  "category": "one of: Engine, Suspension, Brakes, Body, Interior, Tires, Exhaust, Electrical, Other",
  "condition": "one of: New, Like New, Good, Fair — based on visual appearance",
  "description": "2-3 sentences describing the part, any visible wear, notable features, and potential fitment"
}`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: "AI service error" });
    }
    const text = data.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "Invalid AI response" });
    }
    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    console.error("ANALYZE PART ERROR:", err);
    res.status(500).json({ error: "Failed to analyze part" });
  }
});

// AI Image Diagnosis route — photo → diagnosis
app.post("/api/analyze-image-diagnosis", async (req, res) => {
  try {
    const { imageBase64, mediaType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "No image provided" });
    }

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
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/jpeg",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: `You are an expert automotive mechanic. Look at this image which may show a car problem, warning light, damage, engine bay, or other automotive issue. Describe what you see and provide a diagnosis.

Respond in JSON format only, no markdown, like this:
{
  "summary": "brief one line summary of what you see",
  "severity": "Low|Medium|High|Critical",
  "causes": ["cause 1", "cause 2", "cause 3"],
  "estimatedCost": "$X - $Y",
  "diyDifficulty": "Easy|Medium|Hard|Professional Only",
  "immediateAction": "what to do right now",
  "diagnosisSteps": ["step 1", "step 2", "step 3"],
  "proTip": "one expert tip"
}

If the image is not automotive related, return:
{
  "error": "not_automotive"
}`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: "AI service error" });
    }
    const text = data.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "Invalid AI response" });
    }
    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    console.error("ANALYZE IMAGE DIAGNOSIS ERROR:", err);
    res.status(500).json({ error: "Failed to analyze image" });
  }
});

// VIN Scanner route — image → VIN number
app.post("/api/scan-vin", async (req, res) => {
  try {
    const { imageBase64, mediaType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "No image provided" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/jpeg",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: `Look at this image and extract the VIN (Vehicle Identification Number). A VIN is exactly 17 characters, containing only letters and numbers (no I, O, or Q).

Respond in JSON format only, no markdown:
{"vin": "17CHARVIN"} 

If no VIN is visible, respond with:
{"vin": null}`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: "AI service error" });
    }
    const text = data.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ vin: null });
    }
    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    console.error("SCAN VIN ERROR:", err);
    res.status(500).json({ error: "Failed to scan VIN" });
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
