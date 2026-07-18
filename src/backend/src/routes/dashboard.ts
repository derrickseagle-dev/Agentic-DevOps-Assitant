/**
 * PipelineForge — Dashboard Routes
 *
 * Endpoint:
 *   GET /api/teams/:teamId/dashboard — aggregated KPIs for the team
 *
 * KPIs returned:
 *   - activePipelines: count of active pipelines
 *   - recentRuns: runs in last 7 days
 *   - pendingApprovals: runs awaiting approval
 *   - successRate: % of completed runs that succeeded (last 30 days)
 *   - deploymentFrequency: deployments in last 30 days
 */

import { Hono } from "hono";
import { db } from "../db";
import { pipelines, pipelineRuns, checkpointApprovals, deployments, repositories } from "../db/schema";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import { teamScopeMiddleware } from "../middleware/team-scope";

const dashboardRoutes = new Hono();

dashboardRoutes.use("*", authMiddleware);
dashboardRoutes.use("/:teamId/*", teamScopeMiddleware);

// GET /api/teams/:teamId/dashboard
dashboardRoutes.get("/:teamId/dashboard", async (c) => {
  const teamId = c.get("teamId") as string;

  // Date boundaries (Date objects for Drizzle timestamp compatibility)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 1. Active pipelines count
  const activePipelineResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(pipelines)
    .where(
      and(eq(pipelines.teamId, teamId), eq(pipelines.status, "active"))
    );
  const activePipelineCount = Number(activePipelineResult[0]?.count ?? 0);

  // 2. Recent runs — count of runs in last 7 days
  // Join through repositories to scope by team
  const teamRepos = db
    .select({ id: repositories.id })
    .from(repositories)
    .where(eq(repositories.teamId, teamId));

  const recentRunsCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(pipelineRuns)
    .where(
      and(
        sql`${pipelineRuns.repositoryId} IN (SELECT id FROM repositories WHERE team_id = ${teamId})`,
        gte(pipelineRuns.createdAt, sevenDaysAgo)
      )
    );
  const recentRunsCount = Number(recentRunsCountResult[0]?.count ?? 0);

  // 3. Pending approvals — count of runs in `awaiting_approval` state
  const pendingApprovalsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(pipelineRuns)
    .where(
      and(
        sql`${pipelineRuns.repositoryId} IN (SELECT id FROM repositories WHERE team_id = ${teamId})`,
        eq(pipelineRuns.status, "awaiting_approval")
      )
    );
  const pendingApprovalsCount = Number(pendingApprovalsResult[0]?.count ?? 0);

  // 4. Success rate — % of completed runs that succeeded (last 30 days)
  const completedRunsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(pipelineRuns)
    .where(
      and(
        sql`${pipelineRuns.repositoryId} IN (SELECT id FROM repositories WHERE team_id = ${teamId})`,
        gte(pipelineRuns.createdAt, thirtyDaysAgo),
        sql`${pipelineRuns.status} IN ('success', 'failed')`
      )
    );
  const totalCompleted = Number(completedRunsResult[0]?.count ?? 0);

  const successfulRunsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(pipelineRuns)
    .where(
      and(
        sql`${pipelineRuns.repositoryId} IN (SELECT id FROM repositories WHERE team_id = ${teamId})`,
        gte(pipelineRuns.createdAt, thirtyDaysAgo),
        eq(pipelineRuns.status, "success")
      )
    );
  const successfulRuns = Number(successfulRunsResult[0]?.count ?? 0);

  const successRate = totalCompleted > 0
    ? Math.round((successfulRuns / totalCompleted) * 100)
    : 100;

  // 5. Deployment frequency — count of deployments in last 30 days
  const deploymentCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(deployments)
    .where(
      and(
        sql`${deployments.repositoryId} IN (SELECT id FROM repositories WHERE team_id = ${teamId})`,
        gte(deployments.deployedAt, thirtyDaysAgo)
      )
    );
  const deploymentFrequency = Number(deploymentCountResult[0]?.count ?? 0);

  return c.json({
    activePipelines: activePipelineCount,
    recentRuns: recentRunsCount,
    pendingApprovals: pendingApprovalsCount,
    deploymentSuccessRate: successRate,
    deploymentFrequency,
    totalPipelines: activePipelineCount, // alias for frontend compatibility
  });
});

export default dashboardRoutes;
