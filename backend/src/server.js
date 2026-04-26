// src/server.js
import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import authRoutes from "./auth/auth.routes.js";
import followRoutes from "./routes/follow.routes.js";
import logsRoutes from "./routes/logs.routes.js";
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

// Force backend to run on 5000 to match your frontend
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});