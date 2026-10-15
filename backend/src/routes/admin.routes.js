// src/routes/admin.routes.js
import express from "express";
import { listDiagnoses } from "../controllers/diagnoses.controller.js";
import { getOpenReportCount, listReports, resolveReport } from "../controllers/reports.controller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Admin checks happen inside each controller (same pattern as the other admin endpoints).
router.get("/reports", authMiddleware, listReports);
router.get("/reports/open-count", authMiddleware, getOpenReportCount);
router.post("/reports/:id/resolve", authMiddleware, resolveReport);
router.get("/diagnoses", authMiddleware, listDiagnoses);

export default router;
