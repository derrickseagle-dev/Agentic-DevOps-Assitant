/**
 * PipelineForge — Deployment Routes
 *
 * Endpoints:
 *   GET /api/teams/:teamId/deployments          — list deployments (filters: repoId, pipelineId, environment)
 *   GET /api/teams/:teamId/deployments/:deployId — get deployment details
 */

import { Hono } from "hono";
import { db } from "../db";
import { deployments, repositories, pipelineRuns, pipelines } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import { teamScopeMiddleware } from "../middleware/team-scope";

const deploymentRoutes = new Hono();

deploymentRoutes.use("*", authMiddleware);
deploymentRoutes.use("/:teamId/*", teamScopeMiddleware);

// ============================================================
// GET /api/teams/:teamId/deployments
// List all deployments for a team, with optional filters
// ============================================================
deploymentRoutes.get("/:teamId/deployments", async (c) => {
  const teamId = c.get("teamId") as string;
  const repoId = c.req.query("repoId");
  const pipelineId = c.req.query("pipelineId");
  const environment = c.req.query("environment");

  // Build conditions
  const conditions = [eq(repositories.teamId, teamId)];

  if (repoId) {
    conditions.push(eq(deployments.repositoryId, repoId));
  }
  if (pipelineId) {
    conditions.push(eq(pipelineRuns.pipelineId, pipelineId));
  }
  if (environment) {
    conditions.push(eq(deployments.environment, environment));
  }

  const result = await db
    .select({
      id: deployments.id,
      pipelineRunId: deployments.pipelineRunId,
      repositoryId: deployments.repositoryId,
      environment: deployments.environment,
      status: deployments.status,
      deployUrl: deployments.deployUrl,
      deployedAt: deployments.deployedAt,
      repositoryName: repositories.name,
      repositoryFullName: repositories.fullName,
      pipelineName: pipelines.name,
      pipelineId: pipelines.id,
      branch: pipelineRuns.branch,
      commitSha: pipelineRuns.commitSha,
      runStatus: pipelineRuns.status,
    })
    .from(deployments)
    .innerJoin(repositories, eq(repositories.id, deployments.repositoryId))
    .innerJoin(pipelineRuns, eq(pipelineRuns.id, deployments.pipelineRunId))
    .innerJoin(pipelines, eq(pipelines.id, pipelineRuns.pipelineId))
    .where(and(...conditions))
    .orderBy(desc(deployments.deployedAt))
    .limit(50);

  return c.json({ deployments: result });
});

// ============================================================
// GET /api/teams/:teamId/deployments/:deployId
// Get a single deployment with full details
// ============================================================
deploymentRoutes.get("/:teamId/deployments/:deployId", async (c) => {
  const teamId = c.get("teamId") as string;
  const deployId = c.req.param("deployId");

  const result = await db
    .select({
      id: deployments.id,
      pipelineRunId: deployments.pipelineRunId,
      repositoryId: deployments.repositoryId,
      environment: deployments.environment,
      status: deployments.status,
      deployUrl: deployments.deployUrl,
      deployedAt: deployments.deployedAt,
      repositoryName: repositories.name,
      repositoryFullName: repositories.fullName,
      pipelineName: pipelines.name,
      pipelineId: pipelines.id,
      branch: pipelineRuns.branch,
      commitSha: pipelineRuns.commitSha,
      commitMessage: pipelineRuns.commitMessage,
      triggeredBy: pipelineRuns.triggeredBy,
      runStatus: pipelineRuns.status,
    })
    .from(deployments)
    .innerJoin(repositories, eq(repositories.id, deployments.repositoryId))
    .innerJoin(pipelineRuns, eq(pipelineRuns.id, deployments.pipelineRunId))
    .innerJoin(pipelines, eq(pipelines.id, pipelineRuns.pipelineId))
    .where(
      and(
        eq(deployments.id, deployId),
        eq(repositories.teamId, teamId)
      )
    )
    .limit(1);

  if (result.length === 0) {
    return c.json({ error: "Deployment not found" }, 404);
  }

  return c.json(result[0]);
});

export default deploymentRoutes;
