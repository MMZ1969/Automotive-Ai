// src/server.js
import cors from "cors";
import { createHash } from "crypto";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import xss from "xss";
dotenv.config();

import prisma from "./lib/prisma.js";
import { buildDiagnosisPrompt, DIAGNOSIS_MODEL, DIAGNOSIS_MAX_TOKENS, DIAGNOSIS_MAX_SEARCHES } from "./lib/diagnosisPrompt.js";
import authMiddleware from "./middleware/authMiddleware.js";

import authRoutes from "./auth/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import carShowRoutes from "./routes/carShow.routes.js";
import followRoutes from "./routes/follow.routes.js";
import jobRoutes from "./routes/job.routes.js";
import logsRoutes from "./routes/logs.routes.js";
import messagesRoutes from "./routes/messages.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import partsRoutes from "./routes/parts.routes.js";
import remindersRoutes from "./routes/reminders.routes.js";
import { startReminderScheduler } from "./jobs/reminderPush.js";
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
app.use("/api/reminders", remindersRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/car-shows", carShowRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/admin", adminRoutes);

// ─── DIAGNOSIS CACHE ──────────────────────────────────────────────────────────
// Keyed by vehicle + exact query text. Two users (or the same user twice)
// asking the same question about the same vehicle get an instant cached
// answer instead of re-running the full search+generation pipeline.
//
// Two layers:
//   - DiagnosisAnswer table (Postgres) — the source of truth. Survives
//     redeploys, so paid-for answers are no longer wiped on every push. Rows
//     are kept indefinitely (they're the start of the diagnosis library); the
//     TTL below only decides when an answer is too old to SERVE, after which
//     the next ask regenerates it and overwrites the row.
//   - diagnosisCache Map — hot layer in front of the DB, capped in size.
// Every DB call here is wrapped so a DB hiccup (or the table not existing yet)
// degrades to "cache miss", never to a failed diagnosis.
const diagnosisCache = new Map();
const DIAGNOSIS_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (was 7; eBay prices are the main thing that ages)
const DIAGNOSIS_HOT_CACHE_MAX = 500;

function getDiagnosisCacheKey(query, vehicle) {
  const vehicleKey = vehicle
    ? `${vehicle.year}-${vehicle.make}-${vehicle.model}-${vehicle.trim || ""}-${vehicle.engine || ""}`
    : "no-vehicle";
  return `${vehicleKey}::${query.trim().toLowerCase()}`;
}

const hashCacheKey = (cacheKey) => createHash("sha256").update(cacheKey).digest("hex");

function hotCacheSet(cacheKey, entry) {
  diagnosisCache.delete(cacheKey); // re-insert so it counts as newest
  diagnosisCache.set(cacheKey, entry);
  while (diagnosisCache.size > DIAGNOSIS_HOT_CACHE_MAX) {
    diagnosisCache.delete(diagnosisCache.keys().next().value); // drop oldest
  }
}

// Returns { data, cachedAt, source } or null. Memory first, then DB.
async function getCachedDiagnosis(cacheKey) {
  const hot = diagnosisCache.get(cacheKey);
  if (hot && Date.now() - hot.cachedAt < DIAGNOSIS_CACHE_TTL_MS) {
    return { ...hot, source: "memory" };
  }
  try {
    const row = await prisma.diagnosisAnswer.findUnique({
      where: { queryKey: hashCacheKey(cacheKey) },
      select: { result: true, generatedAt: true, publishedAt: true },
    });
    // Published (reviewed) answers never expire.
    if (row && (row.publishedAt || Date.now() - row.generatedAt.getTime() < DIAGNOSIS_CACHE_TTL_MS)) {
      const entry = { data: row.result, cachedAt: row.generatedAt.getTime() };
      hotCacheSet(cacheKey, entry);
      return { ...entry, source: "db" };
    }
  } catch (err) {
    console.error("DIAGNOSIS CACHE READ ERROR:", err.message);
  }
  return null;
}

// Fire-and-forget: bump the served counter. updateMany so a missing row is a no-op.
function markDiagnosisServed(cacheKey) {
  prisma.diagnosisAnswer
    .updateMany({
      where: { queryKey: hashCacheKey(cacheKey) },
      data: { hitCount: { increment: 1 }, lastServedAt: new Date() },
    })
    .catch((err) => console.error("DIAGNOSIS CACHE HIT-COUNT ERROR:", err.message));
}

// Write a fresh answer to both layers. Called (not awaited) after res.json(),
// so the user never waits on it.
async function storeDiagnosis(cacheKey, query, vehicle, data) {
  const now = new Date();
  hotCacheSet(cacheKey, { data, cachedAt: now.getTime() });
  try {
    const fields = {
      vehicleLabel: vehicleLabelOf(vehicle),
      year: vehicle?.year ? Number(vehicle.year) || null : null,
      make: vehicle?.make || null,
      model: vehicle?.model || null,
      engine: vehicle?.engine || null,
      query: String(query).slice(0, 2000),
      result: data,
      generatedAt: now,
    };
    const queryKey = hashCacheKey(cacheKey);
    const existing = await prisma.diagnosisAnswer.findUnique({
      where: { queryKey },
      select: { publishedAt: true },
    });
    // A reviewed, published answer is pinned: never overwrite it.
    if (existing?.publishedAt) return;
    await prisma.diagnosisAnswer.upsert({
      where: { queryKey },
      create: { queryKey, ...fields },
      update: fields, // regenerated after TTL: replace the answer, keep hitCount
    });
  } catch (err) {
    console.error("DIAGNOSIS CACHE WRITE ERROR:", err.message);
  }
}

// ─── DIAGNOSIS ACCOUNTING ─────────────────────────────────────────────────────
// Every served diagnosis (fresh or cached) counts toward the daily cap and the
// lifetime total and gets a DiagnosisLog row. Rep (+5) is only paid if this
// user hasn't asked the same question about the same vehicle in the last 24h,
// so re-asking one question 8 times no longer earns 40 rep a day.
const DIAGNOSIS_REP = 5;
const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

function vehicleLabelOf(vehicle) {
  if (!vehicle) return null;
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ") || null;
}

async function recordDiagnosis({ userId, cacheKey, query, vehicle, result, cached }) {
  try {
    const queryKey = hashCacheKey(cacheKey);
    const repeat = await prisma.diagnosisLog.findFirst({
      where: { userId, queryKey, createdAt: { gte: new Date(Date.now() - REPEAT_WINDOW_MS) } },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const repAwarded = !repeat;
    // Same question within 2 min = a double/triple tap, not a new diagnosis
    // (user 235 sent 3 in one second). Still logged, but it doesn't use up
    // one of the 8 daily diagnoses or inflate the total.
    const isDoubleTap = !!repeat && Date.now() - repeat.createdAt.getTime() < 2 * 60 * 1000;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          ...(repAwarded ? { repPoints: { increment: DIAGNOSIS_REP } } : {}),
          ...(isDoubleTap ? {} : { dailyDiagnoses: { increment: 1 }, totalDiagnoses: { increment: 1 } }),
          lastDiagnosisDate: new Date(),
        },
      }),
      prisma.diagnosisLog.create({
        data: {
          userId,
          queryKey,
          vehicleLabel: vehicleLabelOf(vehicle),
          query: String(query).slice(0, 2000),
          summary: typeof result?.summary === "string" ? result.summary.slice(0, 500) : null,
          severity: typeof result?.severity === "string" ? result.severity : null,
          cached,
          repAwarded,
        },
      }),
    ]);
    console.log(`DIAGNOSIS RUN | userId=${userId} | cached=${cached} | rep=${repAwarded ? DIAGNOSIS_REP : 0} | at=${new Date().toISOString()}`);
  } catch (err) {
    console.error("DIAGNOSIS RECORD ERROR:", err);
  }
}

// ─── DIAGNOSIS CONTEXT ────────────────────────────────────────────────────────
// The app only sends a vehicle if the user tapped a chip this visit, so most
// requests arrived with vehicle=null and the model asked for year/make/model
// even when a VIN-decoded vehicle was in the garage (user 235). Resolve the
// vehicle server-side instead:
//   1. vehicle.id sent → load the full row from the DB (must belong to user)
//   2. nothing sent, user has exactly one vehicle → use it
//   3. nothing sent, several vehicles → the one named in the question (make/
//      model), else the one from their most recent diagnosis that had a vehicle
const FOLLOWUP_WINDOW_MS = 30 * 60 * 1000;
const FOLLOWUP_MAX_WORDS = 12;

// Lowercase, strip punctuation, pad with spaces so " jeep " matches whole words only.
const normWords = (s) => ` ${String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

async function resolveDiagnosisVehicle(userId, bodyVehicle, query) {
  try {
    if (bodyVehicle?.id) {
      const v = await prisma.vehicle.findFirst({ where: { id: Number(bodyVehicle.id), userId } });
      if (v) return v;
    }
    if (bodyVehicle?.year && bodyVehicle?.make && bodyVehicle?.model) return bodyVehicle;

    const garage = await prisma.vehicle.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
    if (garage.length === 1) return garage[0];
    if (garage.length > 1) {
      // 1. The question names a vehicle ("jeep front shocks", "my f150 won't start")
      //    → use it if exactly one garage vehicle matches. Model is more specific,
      //    so try it before make (two Fords, one F-150).
      const q = normWords(query);
      const qJoined = q.replace(/ /g, "");
      const hits = (field) => garage.filter((v) => {
        const w = normWords(v[field]);
        return w.trim() && (q.includes(w) || qJoined.includes(w.replace(/ /g, "")));
      });
      const byModel = hits("model");
      if (byModel.length === 1) return byModel[0];
      const byMake = hits("make");
      if (byMake.length === 1) return byMake[0];

      // 2. Otherwise, the vehicle from their most recent diagnosis that had one —
      //    limited to the named make if the question named one ("ford brakes"
      //    with two Fords must not fall back to the Honda).
      const pool = byMake.length > 1 ? byMake : garage;
      const lastWithVehicle = await prisma.diagnosisLog.findFirst({
        where: { userId, vehicleLabel: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { vehicleLabel: true },
      });
      if (lastWithVehicle) {
        const match = pool.find((v) => vehicleLabelOf(v) === lastWithVehicle.vehicleLabel);
        if (match) return match;
      }
    }
  } catch (err) {
    console.error("RESOLVE VEHICLE ERROR:", err.message);
  }
  return null;
}

// A short message right after a previous diagnosis ("what about the rotors?",
// "is it safe to drive?") is almost always a follow-up. Hand the model the
// previous question + summary so it doesn't treat it as a fresh, context-free ask.
function getFollowupContext(query, lastLog) {
  if (!lastLog) return null;
  const words = String(query).trim().split(/\s+/).filter(Boolean).length;
  if (words > FOLLOWUP_MAX_WORDS) return null;
  if (lastLog.query.trim().toLowerCase() === String(query).trim().toLowerCase()) return null;
  return { query: lastLog.query.slice(0, 500), summary: lastLog.summary || "" };
}

// AI Diagnosis route
app.post("/api/diagnose", authMiddleware, async (req, res) => {
  const t0 = Date.now();
  console.log("DIAGNOSIS REQUEST RECEIVED");
  try {
    const { query } = req.body;
    if (!query || !String(query).trim()) {
      return res.status(400).json({ error: "Query required" });
    }

    const lastLog = await prisma.diagnosisLog.findFirst({
      where: { userId: req.user.id, createdAt: { gte: new Date(Date.now() - FOLLOWUP_WINDOW_MS) } },
      orderBy: { createdAt: "desc" },
      select: { query: true, summary: true, vehicleLabel: true },
    });
    let followup = getFollowupContext(query, lastLog);
    // noVehicle=true: the user (1.0.27+) deliberately deselected — respect it.
    // Older builds never send it, so they get the server-side fallback.
    const vehicle = req.body.noVehicle === true
      ? null
      : await resolveDiagnosisVehicle(req.user.id, req.body.vehicle, followup ? `${followup.query} ${query}` : query);
    // The user explicitly picked a different vehicle than last time → new topic,
    // not a follow-up (e.g. "jeep front shocks" then tapping the Harley).
    if (followup && req.body.vehicle && vehicleLabelOf(vehicle) !== lastLog.vehicleLabel) {
      followup = null;
    }
    console.log(`DIAGNOSIS CONTEXT | vehicle=${vehicleLabelOf(vehicle) || "none"} | sent=${req.body.vehicle ? "yes" : "no"} | optOut=${req.body.noVehicle === true ? "yes" : "no"} | followup=${followup ? "yes" : "no"}`);

    // ─── CACHE CHECK ───────────────────────────────────────────────────
    // Follow-up answers depend on the previous question, so they are never
    // read from or written to the shared cache.
    const cacheKey = getDiagnosisCacheKey(query, vehicle);
    const cached = followup ? null : await getCachedDiagnosis(cacheKey);
    if (cached) {
      console.log(`CACHE HIT (${cached.source}) +${Date.now() - t0}ms`);
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
      await recordDiagnosis({ userId, cacheKey, query, vehicle, result: cached.data, cached: true });
      markDiagnosisServed(cacheKey);
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
        model: DIAGNOSIS_MODEL,
        // Was 1500 — a 3-search shocks answer used 1314, so longer procedures
        // risked truncated JSON. Only tokens actually generated are billed.
        max_tokens: DIAGNOSIS_MAX_TOKENS,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: DIAGNOSIS_MAX_SEARCHES }],
        messages: [
          {
            role: "user",
            content: buildDiagnosisPrompt({ query, vehicle, followup }),
          },
        ],
      }),
    });

    const data = await response.json();
    console.log(`ANTHROPIC RESPONSE RECEIVED +${Date.now() - t0}ms | stop=${data.stop_reason} | out=${data.usage?.output_tokens} | searches=${data.usage?.server_tool_use?.web_search_requests ?? 0}`);
    if (data.stop_reason === "max_tokens") {
      console.warn(`DIAGNOSIS TRUNCATED | output_tokens=${data.usage?.output_tokens}`);
    }
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

    // Count it, log it, and award rep unless it's a repeat within 24h
    await recordDiagnosis({ userId, cacheKey, query, vehicle, result: parsed, cached: false });

    console.log(`RESPONSE SENT +${Date.now() - t0}ms`);
    res.json(parsed);

    // Store for next time this exact vehicle+query comes in — memory + DB,
    // after the response so the user doesn't wait on the write.
    // (Skip follow-ups — their answer depends on the previous question.)
    // Not awaited: anything thrown here must never reach the catch below,
    // which would try to send a second response (ERR_HTTP_HEADERS_SENT).
    if (!followup) {
      storeDiagnosis(cacheKey, query, vehicle, parsed).catch((err) =>
        console.error("DIAGNOSIS CACHE STORE ERROR:", err.message)
      );
    }
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
        max_tokens: 2000,
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

// ─── YOUTUBE VIDEOS ──────────────────────────────────────────────────────────
// The app shows these under every diagnosis and people watch the top one, so
// order matters. Pull 15 results + their details and rank them:
//   trusted repair channels first, title mentions the vehicle, real how-to
//   length (no Shorts, no hour-long streams), then popularity.
// Results are cached per query: a YouTube search costs 100 of the 10,000
// daily quota units, so uncached we'd top out around 100 diagnoses/day.
// Michael's trusted list — edit freely (lowercase, matched as part of the channel name).
const TRUSTED_CHANNELS = [
  "trq", "1a auto", "chrisfix", "ericthecarguy", "humble mechanic",
  "south main auto", "pine hollow auto", "fcp euro", "rainman ray",
  "mechanic mindset", "pistons and pixie", "faye hadley", "fayehadley",
];
const youtubeCache = new Map();
const YOUTUBE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const YOUTUBE_CACHE_MAX = 1000;

// "PT14M3S" -> 843
function isoDurationSeconds(iso) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "");
  return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
}
const isTrustedChannel = (name) => {
  const n = String(name || "").toLowerCase();
  return TRUSTED_CHANNELS.some((t) => n.includes(t));
};

// The app sends "Vehicle: 2010 FORD F-150. Oil leak above starter" for text
// diagnoses, or the AI summary for photo scans. Clean it up and pull out the
// vehicle so titles that mention it can be preferred.
function cleanVideoQuery(raw) {
  const q = String(raw || "")
    .replace(/^\s*vehicle:\s*/i, "")
    .replace(/\s*\.\s+/g, " ")
    .replace(/[^\w\s\-./&']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
  const v = /\b((?:19|20)\d{2})\s+([A-Za-z][\w-]*)\s+([\w-]+)/.exec(q);
  return { q, make: v?.[2]?.toLowerCase() || null, model: v?.[3]?.toLowerCase() || null };
}

async function findRepairVideos(rawQuery) {
  const { q, make, model } = cleanVideoQuery(rawQuery);
  if (!q) return [];
  const cacheKey = q.toLowerCase();
  const hit = youtubeCache.get(cacheKey);
  if (hit && Date.now() - hit.at < YOUTUBE_CACHE_TTL_MS) return hit.videos;

  const key = process.env.YOUTUBE_API_KEY;
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=15&relevanceLanguage=en&safeSearch=moderate&q=${encodeURIComponent(`${q} repair`)}&key=${key}`;
  const search = await (await fetch(searchUrl)).json();
  const items = (search.items || []).filter((it) => it.id?.videoId);
  if (!items.length) return [];

  // Duration + view counts: 1 quota unit for all 15. If it fails, rank without it.
  let details = {};
  try {
    const ids = items.map((it) => it.id.videoId).join(",");
    const d = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${ids}&key=${key}`)).json();
    for (const v of d.items || []) {
      details[v.id] = { seconds: isoDurationSeconds(v.contentDetails?.duration), views: Number(v.statistics?.viewCount) || 0 };
    }
  } catch (err) {
    console.error("YOUTUBE DETAILS ERROR:", err.message);
  }

  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ranked = items
    .map((it, idx) => {
      const title = it.snippet?.title || "";
      const channel = it.snippet?.channelTitle || "";
      const det = details[it.id.videoId];
      const trusted = isTrustedChannel(channel);
      let score = (15 - idx) * 1.5;                               // YouTube's own relevance
      if (trusted) score += 30;
      if (model && norm(title).includes(norm(model))) score += 16; // right vehicle
      else if (make && norm(title).includes(norm(make))) score += 4;
      if (det) {
        if (det.seconds > 0 && det.seconds < 75) score -= 100;     // Shorts
        if (det.seconds > 60 * 60) score -= 40;                    // streams / marathons
        if (det.seconds >= 180 && det.seconds <= 35 * 60) score += 4;
        score += Math.log10(det.views + 1) * 2.5;                  // ~+10 at 10k views, +15 at 1M
      }
      return {
        videoId: it.id.videoId,
        // YouTube returns HTML entities in titles ("&#39;"); the app shows plain text
        title: title.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&"),
        thumbnail: it.snippet?.thumbnails?.medium?.url,
        channel,
        trusted,
        score,
      };
    })
    .filter((v) => v.score > -50)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ score, ...v }) => v);

  youtubeCache.set(cacheKey, { videos: ranked, at: Date.now() });
  while (youtubeCache.size > YOUTUBE_CACHE_MAX) youtubeCache.delete(youtubeCache.keys().next().value);
  console.log(`YOUTUBE | q="${q}" | top: ${ranked[0] ? `${ranked[0].channel}${ranked[0].trusted ? " (trusted)" : ""}` : "none"}`);
  return ranked;
}

app.get("/api/youtube", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.json([]);
    res.json(await findRepairVideos(query));
  } catch (err) {
    console.error("YOUTUBE ERROR:", err);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

// SAVE a diagnosis
app.post("/api/diagnose/save", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { query, vehicleId, vehicleLabel, summary, severity, causes, estimatedCost, diyDifficulty, immediateAction, diagnosisSteps, proTip, ebayParts } = req.body;

    if (!summary || !diagnosisSteps) {
      return res.status(400).json({ error: "Missing diagnosis data" });
    }

    const saved = await prisma.savedDiagnosis.create({
      data: {
        userId,
        vehicleId: vehicleId || null,
        vehicleLabel: vehicleLabel || null,
        query: query || "",
        summary,
        severity: severity || "Medium",
        causes: causes || [],
        estimatedCost: estimatedCost || null,
        diyDifficulty: diyDifficulty || null,
        immediateAction: immediateAction || null,
        diagnosisSteps,
        proTip: proTip || null,
        ebayParts: ebayParts || null,
      },
    });

    res.json(saved);
  } catch (err) {
    console.error("SAVE DIAGNOSIS ERROR:", err);
    res.status(500).json({ error: "Failed to save diagnosis" });
  }
});

// LIST saved diagnoses (optionally filtered by vehicleId)
app.get("/api/diagnose/saved", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { vehicleId } = req.query;

    const where = { userId };
    if (vehicleId) where.vehicleId = Number(vehicleId);

    const saved = await prisma.savedDiagnosis.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json(saved);
  } catch (err) {
    console.error("LIST SAVED DIAGNOSES ERROR:", err);
    res.status(500).json({ error: "Failed to fetch saved diagnoses" });
  }
});

// GET one saved diagnosis
app.get("/api/diagnose/saved/:id", authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const saved = await prisma.savedDiagnosis.findUnique({ where: { id } });
    if (!saved || saved.userId !== req.user.id) {
      return res.status(404).json({ error: "Saved diagnosis not found" });
    }
    res.json(saved);
  } catch (err) {
    console.error("GET SAVED DIAGNOSIS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch saved diagnosis" });
  }
});

// DELETE a saved diagnosis
app.delete("/api/diagnose/saved/:id", authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const saved = await prisma.savedDiagnosis.findUnique({ where: { id } });
    if (!saved || saved.userId !== req.user.id) {
      return res.status(404).json({ error: "Saved diagnosis not found" });
    }
    await prisma.savedDiagnosis.delete({ where: { id } });
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE SAVED DIAGNOSIS ERROR:", err);
    res.status(500).json({ error: "Failed to delete saved diagnosis" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startReminderScheduler();
});