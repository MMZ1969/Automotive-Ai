// src/server.js
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import xss from "xss";
dotenv.config();

import prisma from "./lib/prisma.js";
import authMiddleware from "./middleware/authMiddleware.js";

import authRoutes from "./auth/auth.routes.js";
import carShowRoutes from "./routes/carShow.routes.js";
import followRoutes from "./routes/follow.routes.js";
import jobRoutes from "./routes/job.routes.js";
import logsRoutes from "./routes/logs.routes.js";
import messagesRoutes from "./routes/messages.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import partsRoutes from "./routes/parts.routes.js";
import postsRoutes from "./routes/posts.js";
import reviewRoutes from "./routes/reviews.js";
import uploadRoutes from "./routes/upload.js";
import userRoutes from "./routes/user.routes.js";
import vehiclesRoutes from "./routes/vehicles.routes.js";

const app = express();
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ─── INPUT SANITIZATION ───────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.body && typeof req.body === "object") {
    const sanitize = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === "string") {
          obj[key] = xss(obj[key]);
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          sanitize(obj[key]);
        }
      }
    };
    sanitize(req.body);
  }
  next();
});
// ──────────────────────────────────────────────────────────────────────────────

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please slow down." },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts. Please try again in 15 minutes." },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many accounts created. Please try again later." },
});

app.use("/api", generalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", registerLimiter);
// ─────────────────────────────────────────────────────────────────────────────

// ─── EBAY HELPERS ────────────────────────────────────────────────────────────

// Step 1: Get an eBay OAuth token using our App ID + Cert ID.
// Cached in memory and reused until shortly before it expires — eBay
// client-credentials tokens are typically valid ~2 hours, so re-fetching
// one per part, per diagnosis request was pure wasted latency sitting
// between "Claude finished" and "user sees the result."
let cachedEbayToken = null;
let cachedEbayTokenExpiresAt = 0;

async function getEbayToken() {
  if (cachedEbayToken && Date.now() < cachedEbayTokenExpiresAt) {
    return cachedEbayToken;
  }

  const credentials = Buffer.from(
    `${process.env.EBAY_APP_ID}:${process.env.EBAY_CERT_ID}`
  ).toString("base64");

  const response = await fetch(
    "https://api.ebay.com/identity/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    }
  );

  const data = await response.json();
  if (!data.access_token) {
    console.error("EBAY TOKEN ERROR:", JSON.stringify(data));
    return null;
  }

  cachedEbayToken = data.access_token;
  // Refresh 5 minutes early so we never hand out a token that's about to expire
  cachedEbayTokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

  return cachedEbayToken;
}

// Step 2: Search eBay for a part and return a price range
async function getEbayPriceRange(partName, vehicle) {
  try {
    const token = await getEbayToken();
    if (!token) return null;

    // Build search query: e.g. "2018 Honda Civic alternator"
    const vehicleContext = vehicle
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
      : "";
    const searchQuery = encodeURIComponent(
      `${vehicleContext} ${partName}`.trim()
    );

    const response = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${searchQuery}&category_ids=6030&limit=20&filter=conditionIds:%7B1000|1500|2000|2500%7D`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        },
      }
    );

    const data = await response.json();
    const items = data.itemSummaries;

    if (!items || items.length === 0) return null;

    // Pull out prices and find the range
    const prices = items
      .map((item) => parseFloat(item.price?.value))
      .filter((p) => !isNaN(p) && p > 0);

    if (prices.length === 0) return null;

    const min = Math.min(...prices);
    const max = Math.max(...prices);

    // Build a search URL so users can tap and browse on eBay
    const ebaySearchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${vehicleContext} ${partName}`.trim())}&_sacat=6030`;

    return {
      partName,
      priceMin: min.toFixed(0),
      priceMax: max.toFixed(0),
      listingCount: prices.length,
      ebayUrl: ebaySearchUrl,
    };
  } catch (err) {
    console.error(`EBAY PRICE ERROR for ${partName}:`, err);
    return null;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

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
app.use("/api/car-shows", carShowRoutes);
app.use("/api/messages", messagesRoutes);

// ─── DIAGNOSIS CACHE ──────────────────────────────────────────────────────────
// Keyed by vehicle + exact query text. Two users (or the same user twice)
// asking the same question about the same vehicle get an instant cached
// answer instead of re-running the full search+generation pipeline.
// TTL is generous (7 days) since vehicle specs don't change; this doesn't
// touch search depth or prompt logic at all, so it carries no accuracy risk.
const diagnosisCache = new Map();
const DIAGNOSIS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getDiagnosisCacheKey(query, vehicle) {
  const vehicleKey = vehicle
    ? `${vehicle.year}-${vehicle.make}-${vehicle.model}-${vehicle.trim || ""}-${vehicle.engine || ""}`
    : "no-vehicle";
  return `${vehicleKey}::${query.trim().toLowerCase()}`;
}

// AI Diagnosis route
app.post("/api/diagnose", authMiddleware, async (req, res) => {
  const t0 = Date.now();
  console.log("DIAGNOSIS REQUEST RECEIVED");
  try {
    const { query, vehicle } = req.body;

    // ─── CACHE CHECK ───────────────────────────────────────────────────
    const cacheKey = getDiagnosisCacheKey(query, vehicle);
    const cached = diagnosisCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < DIAGNOSIS_CACHE_TTL_MS) {
      console.log(`CACHE HIT +${Date.now() - t0}ms`);
      // Still enforce the daily limit and award rep for a cached diagnosis —
      // from the user's perspective they ran a diagnosis, they just got it
      // fast because someone already asked this exact question.
      const userId = req.user.id;
      const userData = await prisma.user.findUnique({
        where: { id: userId },
        select: { dailyDiagnoses: true, lastDiagnosisDate: true, isAdmin: true },
      });
      if (!userData?.isAdmin) {
        const today = new Date();
        const lastDate = userData?.lastDiagnosisDate;
        const isNewDay = !lastDate || lastDate.toDateString() !== today.toDateString();
        if (isNewDay) {
          await prisma.user.update({
            where: { id: userId },
            data: { dailyDiagnoses: 0, lastDiagnosisDate: today },
          });
        }
        const currentCount = isNewDay ? 0 : userData?.dailyDiagnoses || 0;
        if (currentCount >= 8) {
          return res.status(429).json({
            error: "Daily limit reached. You get 8 free diagnoses per day. Come back tomorrow!",
            limitReached: true,
          });
        }
      }
      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            repPoints: { increment: 5 },
            dailyDiagnoses: { increment: 1 },
            totalDiagnoses: { increment: 1 },
            lastDiagnosisDate: new Date(),
          },
        });
      } catch (repErr) {
        console.error("REP AWARD ERROR:", repErr);
      }
      console.log(`RESPONSE SENT (cached) +${Date.now() - t0}ms`);
      return res.json(cached.data);
    }
    // ─────────────────────────────────────────────────────────────────

    // ─── DAILY LIMIT CHECK ───────────────────────────────────────────
    const userId = req.user.id;
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: { dailyDiagnoses: true, lastDiagnosisDate: true, isAdmin: true },
    });

    // Admins (currently just Michael) get unlimited diagnoses — everyone
    // else keeps the 8/day cap to protect API cost as usage grows.
    if (!userData?.isAdmin) {
      const today = new Date();
      const lastDate = userData?.lastDiagnosisDate;
      const isNewDay =
        !lastDate || lastDate.toDateString() !== today.toDateString();

      if (isNewDay) {
        await prisma.user.update({
          where: { id: userId },
          data: { dailyDiagnoses: 0, lastDiagnosisDate: today },
        });
      }

      const currentCount = isNewDay ? 0 : userData?.dailyDiagnoses || 0;

      if (currentCount >= 8) {
        return res.status(429).json({
          error:
            "Daily limit reached. You get 8 free diagnoses per day. Come back tomorrow!",
          limitReached: true,
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────
    console.log(`DAILY LIMIT CHECK DONE +${Date.now() - t0}ms`);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
        messages: [
          {
            role: "user",
            content: `You are an expert automotive mechanic and diagnostician. A user has described a car problem or repair task. Analyze it and provide:

1. Most likely causes (top 3) — or, if the user is asking about a specific repair/replacement/installation task rather than an unknown problem, the top considerations for that job
2. Severity level (Low/Medium/High/Critical)
3. Estimated repair cost range
4. DIY difficulty (Easy/Medium/Hard/Professional Only)
5. Immediate action needed
6. Step by step instructions — see INTENT and STEP FORMAT below
7. A list of parts the user would likely need to purchase to fix this problem

${vehicle ? `Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}${vehicle.engine ? ` | Engine: ${vehicle.engine}` : ""}${vehicle.engineCylinders ? ` ${vehicle.engineCylinders}-cyl` : ""}${vehicle.driveType ? ` | Drive: ${vehicle.driveType}` : ""}${vehicle.vin ? ` | VIN: ${vehicle.vin}` : ""}` : "No specific vehicle provided."}

User's problem: "${query}"

INTENT — determine what the user is actually asking for and match your steps to it:
- If the user describes a symptom or unknown problem ("noise when braking," "check engine light") → diagnosisSteps should be diagnostic: how to inspect, test, and narrow down the cause.
- If the user is asking about a specific repair, replacement, or installation task ("replace rear struts," "how do I do a brake job," "install a new alternator") → diagnosisSteps should be the actual repair procedure: removal steps, reassembly steps, torque specs, and sequence — NOT just "how to inspect this part for wear." They already know what needs doing; give them the procedure to do it, in order.

SCOPE DISCIPLINE — match what the user actually asked, don't upsell to a bigger job:
- If they said "rear brakes" or "brake pads," answer about pads (and rotors ONLY if rotor service is a standard/expected part of that specific job on this vehicle) — do not default to the full pad+rotor+parking-brake-actuator job unless they said "replace" or described symptoms that clearly implicate all of those parts.
- If they asked about one component, don't silently expand the diagnosis or steps to cover adjacent components unless the vehicle's actual service procedure requires touching them (e.g., some parking brake actuators genuinely must be retracted to service rear pads — only include that step if it is actually required for the vehicle in question, not as a default add-on).
- When in doubt about scope, answer the narrower interpretation and let the user ask a follow-up for more.

STEP FORMAT — each diagnosis step should be a clear, specific, actionable instruction string. If you have a genuinely useful practical tip for a particular step (a gotcha to avoid, a "while you're in there" note, a safety reminder), fold it into that same step's text naturally rather than as a separate field — e.g. "Remove the caliper guide pin bolts (top and bottom) — support the caliper with wire, don't let it hang on the brake hose." Don't force a tip into every step; only add one when it's genuinely useful.

USE WEB SEARCH — this is critical for accuracy. You have a web_search tool available. Use it whenever you're about to state a vehicle-specific fact you don't already know with certainty for THIS exact vehicle — especially:
- Torque specs for suspension, wheel, and drivetrain fasteners
- Socket/wrench sizes and fastener types (hex, torx, external torx/E-size, etc.) — INCLUDING lug nut / wheel socket sizes, which vary by trim and wheel package and must ALWAYS be verified by search, never stated from memory, since a wrong lug socket size sends someone to the store for the wrong tool
- Bolt patterns and tightening sequences
- Component access points and disassembly order
- Anything that varies by trim, engine option, or model year

Search for the specific year/make/model/trim/engine given. Prefer manufacturer service info, established repair reference sites, and specific how-to sources over generic forum speculation when you can find them. If you get a clear, consistent answer from search — state it directly and specifically, as fact, citing your source implicitly through confidence (no need to show raw citations in the JSON output). If search results are thin, conflicting, or don't cover this exact vehicle/trim — say so honestly rather than picking one source's number and presenting it as certain: give your best estimate and flag it clearly, e.g. "sources vary here — confirm your exact torque spec before final tightening."

CRITICAL — do not invent a reason to prefer one conflicting source over another. If your search results disagree with each other on a specific number (e.g. one source says 17mm, another says 19mm), you must NOT silently pick one and state it as fact, and you must NOT fabricate a plausible-sounding explanation for the discrepancy (e.g. claiming one applies to "aftermarket wheels" or "an earlier trim") unless a search result actually said that explicitly. When sources genuinely conflict, say so directly in the actual step text the user sees: e.g. "Sources disagree on lug nut socket size for this vehicle — commonly reported as either 17mm or 19mm. Verify with a socket set or your owner's manual before starting." A visible, honest conflict is far better than a confident guess dressed up with an invented justification.

If a search errors out or gets cut off before you can complete it (e.g. hitting a search limit), do not silently fill that gap with an unverified guess stated as fact — say plainly that this specific spec wasn't confirmed and should be checked before starting, the same way you'd handle a genuinely thin result.

Do NOT skip searching just to answer faster. A slower correct answer is the entire point of this app. Do NOT state a specific torque value, socket size, fastener type, or access location as fact unless you either (a) searched and found a clear answer, or (b) are already highly confident it's a standard, well-documented spec for this vehicle class. Never guess a specific number or location and present it as fact — whether or not you attach a disclaimer to it. If you're not sure, say so plainly instead of picking a specific-sounding wrong answer and hedging around it.

This applies to procedure and location just as much as numbers. A wrong access point is as dangerous as a wrong torque value, because it sends the user down the wrong disassembly path.

This calibration works alongside — not instead of — giving specific, actionable answers. Do NOT default to vague guidance ("remove the assembly," "consult a repair manual," "check AllData/Mitchell") as your primary answer, and do not defer to searching as an excuse to avoid giving a real answer once you've searched. Search, then answer specifically. Only hedge when the search itself didn't give you a clear answer.

For part numbers: NEVER provide specific part numbers. Instead mention the part name only (e.g. "tail light bulb" or "brake caliper") and set proTip to include "Bring your VIN to any auto parts store for the exact part number for your specific vehicle."

For the parts array: list only parts the user would need to BUY (not tools). Use simple generic names like "alternator", "brake pads", "serpentine belt". Maximum 4 parts. If no parts need to be purchased (e.g. just a fluid top-up or adjustment), return an empty array.

If no vehicle is provided, ask the user to select their vehicle for better accuracy.

IMPORTANT: If the user's input is clearly NOT about a vehicle or automotive issue (e.g. cooking, trivia, anything unrelated to cars, trucks, or motorcycles), do NOT attempt a diagnosis. Instead respond ONLY with this exact JSON, nothing else:
{"error": "not_automotive"}

After you finish any searching, respond with ONLY the final JSON object below — no markdown, no search commentary, no explanation of what you searched for, just the JSON:
{
  "summary": "brief one line summary",
  "severity": "Low|Medium|High|Critical",
  "causes": ["cause 1", "cause 2", "cause 3"],
  "estimatedCost": "$X - $Y",
  "diyDifficulty": "Easy|Medium|Hard|Professional Only",
  "immediateAction": "what to do right now",
  "diagnosisSteps": ["step 1 instruction, with any useful tip folded in naturally", "step 2 instruction"],
  "proTip": "one expert tip",
  "parts": ["part name 1", "part name 2"]
}`,
          },
        ],
      }),
    });

    const data = await response.json();
    console.log(`ANTHROPIC RESPONSE RECEIVED +${Date.now() - t0}ms`);
    console.log("ANTHROPIC RESPONSE:", JSON.stringify(data));
    if (!data.content || data.content.length === 0) {
      return res.status(500).json({ error: "AI service error", details: data });
    }
    // With web_search enabled, content can include server_tool_use and
    // web_search_tool_result blocks alongside text blocks — concatenate
    // just the text blocks to get Claude's actual final answer.
    const text = data.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    if (!text) {
      return res.status(500).json({ error: "AI service error", details: data });
    }
    const cleaned = text.replace(/```json|```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "Invalid AI response" });
    }
    const parsed = JSON.parse(jsonMatch[0]);

    // If the AI judged the input non-automotive, bail BEFORE awarding rep or counting a diagnosis
    if (parsed.error === "not_automotive") {
      return res.json({ error: "not_automotive" });
    }

    // ─── EBAY PRICE LOOKUP ────────────────────────────────────────────
    let ebayParts = [];
    try {
    if (parsed.parts && parsed.parts.length > 0) {
    const ebayResults = await Promise.all(
      parsed.parts.map((part) => getEbayPriceRange(part, vehicle))
    );
    ebayParts = ebayResults.filter(Boolean);
      }
    } catch (ebayErr) {
  console.error("EBAY LOOKUP FAILED:", ebayErr.message);
}
parsed.ebayParts = ebayParts;
    console.log(`EBAY LOOKUP DONE +${Date.now() - t0}ms`);
    // ─────────────────────────────────────────────────────────────────

    // Award +5 rep for running a diagnosis
    try {
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          repPoints: { increment: 5 },
          dailyDiagnoses: { increment: 1 },
          totalDiagnoses: { increment: 1 },
          lastDiagnosisDate: new Date(),
        },
      });
    } catch (repErr) {
      console.error("REP AWARD ERROR:", repErr);
    }

    // Store in cache for next time this exact vehicle+query comes in
    diagnosisCache.set(cacheKey, { data: parsed, cachedAt: Date.now() });

    console.log(`RESPONSE SENT +${Date.now() - t0}ms`);
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
    const cleaned = text.replace(/```json|```/g, "").trim();
const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
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
app.post("/api/analyze-image-diagnosis", authMiddleware, async (req, res) => {
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
    const cleaned = text.replace(/```json|```/g, "").trim();
const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "Invalid AI response" });
    }
    const parsed = JSON.parse(jsonMatch[0]);

    // Award +5 rep for image diagnosis too
    try {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { repPoints: { increment: 5 } },
      });
    } catch (repErr) {
      console.error("REP AWARD ERROR:", repErr);
    }

    res.json(parsed);
  } catch (err) {
    console.error("ANALYZE IMAGE DIAGNOSIS ERROR:", err);
    res.status(500).json({ error: "Failed to analyze image" });
  }
});

// Receipt Scanner route
app.post("/api/scan-receipt", authMiddleware, async (req, res) => {
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
        model: "claude-sonnet-4-5",
        max_tokens: 500,
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
                text: `Extract information from this auto service receipt and respond ONLY with JSON, no markdown:
{
  "title": "service type (e.g. Oil Change, Brake Replacement)",
  "date": "YYYY-MM-DD format or empty string",
  "cost": "numeric amount only or empty string",
  "mileage": "numeric mileage or empty string",
  "description": "brief summary of services performed"
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
    console.error("SCAN RECEIPT ERROR:", err);
    res.status(500).json({ error: "Failed to scan receipt" });
  }
});

// Voice Log route
app.post("/api/voice-log", authMiddleware, async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: "No transcript provided" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: `You are an automotive maintenance log assistant. Extract maintenance log details from this voice transcript and respond ONLY with JSON, no markdown:
{
  "title": "service type (e.g. Oil Change, Brake Replacement)",
  "date": "YYYY-MM-DD format or empty string",
  "cost": "numeric amount only or empty string",
  "mileage": "numeric mileage only or empty string",
  "description": "brief summary of the service"
}

If you cannot determine a field, use an empty string.

Voice transcript: "${transcript}"`,
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
    console.error("VOICE LOG ERROR:", err);
    res.status(500).json({ error: "Failed to parse voice log" });
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

    const videos =
      data.items?.map((item) => ({
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