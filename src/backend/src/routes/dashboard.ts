import { Hono } from "hono";
import { db } from "../db";
import { pipelines } from "../db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import { teamScopeMiddleware } from "../middleware/team-scope";

const dashboardRoutes = new Hono();

// All dashboard routes require auth + team scope
dashboardRoutes.use("*", authMiddleware);
dashboardRoutes.use("/:teamId/*", teamScopeMiddleware);

// GET /api/teams/:teamId/dashboard
dashboardRoutes.get("/:teamId/dashboard", async (c) => {
  const teamId = c.get("teamId");

  // Active pipelines count
  const activePipelineCount = await db.$count(
    pipelines,
    eq(pipelines.teamId, teamId),
  );

  // For MVP (M1), other KPIs return placeholder values.
  // Cross-table aggregates for runs/approvals will be populated in M4+.

  return c.json({
    activePipelines: activePipelineCount,
    recentRuns: 0,
    pendingApprovals: 0,
    deploymentSuccessRate: 100,
  });
});

export default dashboardRoutes;
