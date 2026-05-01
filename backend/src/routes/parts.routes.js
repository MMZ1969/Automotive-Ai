import express from "express";
import * as partsController from "../controllers/parts.controller.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/mine", authMiddleware, partsController.getMyParts);
router.get("/", authMiddleware, partsController.getParts);
router.get("/:id", authMiddleware, partsController.getPartById);
router.post("/", authMiddleware, partsController.createPart);
router.put("/:id", authMiddleware, partsController.updatePart);
router.delete("/:id", authMiddleware, partsController.deletePart);

export default router;
