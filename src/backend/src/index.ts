import { Hono } from "hono";
import { cors } from "hono/cors";
import authRoutes from "./routes/auth";
import teamRoutes from "./routes/teams";
import dashboardRoutes from "./routes/dashboard";
import repositoryRoutes from "./routes/repositories";
import pipelineRoutes from "./routes/pipelines";

// Run migrations on startup
import "./db/migrate";

const app = new Hono();

// CORS for frontend dev server
app.use("*", cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Auth routes (unauthenticated)
app.route("/auth", authRoutes);

// Dashboard routes first (more specific paths before generic /:teamId)
app.route("/api/teams", dashboardRoutes);

// Repository routes (with /:teamId/repositories sub-routes)
app.route("/api/teams/:teamId/repositories", repositoryRoutes);

// Pipeline routes (with /:teamId/pipelines sub-routes)
app.route("/api/teams/:teamId/pipelines", pipelineRoutes);

// API routes (most require auth)
app.route("/api/teams", teamRoutes);

// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error("[api] Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// For Bun's built-in server:
const port = parseInt(process.env.PORT || "3001", 10);

console.log(`[backend] PipelineForge API starting on port ${port}...`);

export default {
  port,
  fetch: app.fetch,
};
