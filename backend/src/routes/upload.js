// src/routes/upload.js
import express from "express";
import multer from "multer";
import path from "path";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // adjust if your upload folder is different
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Upload endpoint (protected)
router.post("/", authMiddleware, upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    res.json({
      message: "File uploaded successfully",
      filename: req.file.filename,
      path: `/uploads/${req.file.filename}`,
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ error: "File upload failed" });
  }
});

export default router;