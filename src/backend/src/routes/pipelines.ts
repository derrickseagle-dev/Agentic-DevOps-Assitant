import { Hono } from "hono";
import { db } from "../db";
import { pipelines, repositories } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { authMiddleware } from "../middleware/auth";
import { teamScopeMiddleware } from "../middleware/team-scope";
import { createPipelineSchema, updatePipelineSchema } from "../../../shared/src/schemas";

const pipelineRoutes = new Hono();

// All pipeline routes require auth + team scope
pipelineRoutes.use("*", authMiddleware);
pipelineRoutes.use("*", teamScopeMiddleware);

// ============================================================
// GET /api/teams/:teamId/pipelines — list pipelines
// ============================================================
pipelineRoutes.get("/", async (c) => {
  const teamId = c.get("teamId") as string;
  const repoId = c.req.query("repoId");

  let conditions = [eq(pipelines.teamId, teamId)];
  if (repoId) {
    conditions.push(eq(pipelines.repositoryId, repoId));
  }

  const result = await db
    .select({
      id: pipelines.id,
      teamId: pipelines.teamId,
      repositoryId: pipelines.repositoryId,
      name: pipelines.name,
      triggerMode: pipelines.triggerMode,
      triggerBranches: pipelines.triggerBranches,
      config: pipelines.config,
      status: pipelines.status,
      createdBy: pipelines.createdBy,
      createdAt: pipelines.createdAt,
      updatedAt: pipelines.updatedAt,
      repoName: repositories.name,
      repoFullName: repositories.fullName,
    })
    .from(pipelines)
    .leftJoin(repositories, eq(pipelines.repositoryId, repositories.id))
    .where(and(...conditions))
    .orderBy(pipelines.updatedAt);

  return c.json({ pipelines: result });
});

// ============================================================
// POST /api/teams/:teamId/pipelines — create pipeline
// ============================================================
pipelineRoutes.post("/", async (c) => {
  const teamId = c.get("teamId") as string;
  const userId = c.get("userId") as string;

  const body = await c.req.json();
  const parsed = createPipelineSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const { repositoryId, name, triggerMode, triggerBranches, config } = parsed.data;

  // Verify the repository belongs to this team
  const repo = await db
    .select({ id: repositories.id })
    .from(repositories)
    .where(and(eq(repositories.id, repositoryId), eq(repositories.teamId, teamId)))
    .limit(1);

  if (repo.length === 0) {
    return c.json({ error: "Repository not found or not in this team" }, 404);
  }

  const now = new Date().toISOString();
  const pipelineId = uuidv4();

  await db.insert(pipelines).values({
    id: pipelineId,
    teamId,
    repositoryId,
    name,
    triggerMode: triggerMode || "manual",
    triggerBranches: JSON.stringify(triggerBranches || []),
    config: JSON.stringify(config),
    status: "draft",
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  const created = await db
    .select({
      id: pipelines.id,
      teamId: pipelines.teamId,
      repositoryId: pipelines.repositoryId,
      name: pipelines.name,
      triggerMode: pipelines.triggerMode,
      triggerBranches: pipelines.triggerBranches,
      config: pipelines.config,
      status: pipelines.status,
      createdBy: pipelines.createdBy,
      createdAt: pipelines.createdAt,
      updatedAt: pipelines.updatedAt,
      repoName: repositories.name,
      repoFullName: repositories.fullName,
    })
    .from(pipelines)
    .leftJoin(repositories, eq(pipelines.repositoryId, repositories.id))
    .where(eq(pipelines.id, pipelineId))
    .limit(1);

  return c.json(created[0], 201);
});

// ============================================================
// GET /api/teams/:teamId/pipelines/:pipelineId — get detail
// ============================================================
pipelineRoutes.get("/:pipelineId", async (c) => {
  const teamId = c.get("teamId") as string;
  const pipelineId = c.req.param("pipelineId");

  const result = await db
    .select({
      id: pipelines.id,
      teamId: pipelines.teamId,
      repositoryId: pipelines.repositoryId,
      name: pipelines.name,
      triggerMode: pipelines.triggerMode,
      triggerBranches: pipelines.triggerBranches,
      config: pipelines.config,
      status: pipelines.status,
      createdBy: pipelines.createdBy,
      createdAt: pipelines.createdAt,
      updatedAt: pipelines.updatedAt,
      repoName: repositories.name,
      repoFullName: repositories.fullName,
      repoDefaultBranch: repositories.defaultBranch,
    })
    .from(pipelines)
    .leftJoin(repositories, eq(pipelines.repositoryId, repositories.id))
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.teamId, teamId)))
    .limit(1);

  if (result.length === 0) {
    return c.json({ error: "Pipeline not found" }, 404);
  }

  return c.json(result[0]);
});

// ============================================================
// PATCH /api/teams/:teamId/pipelines/:pipelineId — update
// ============================================================
pipelineRoutes.patch("/:pipelineId", async (c) => {
  const teamId = c.get("teamId") as string;
  const pipelineId = c.req.param("pipelineId");

  // Verify pipeline belongs to this team
  const existing = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.teamId, teamId)))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "Pipeline not found" }, 404);
  }

  const body = await c.req.json();
  const parsed = updatePipelineSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const updateData: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };

  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.triggerMode !== undefined) updateData.triggerMode = parsed.data.triggerMode;
  if (parsed.data.triggerBranches !== undefined) {
    updateData.triggerBranches = JSON.stringify(parsed.data.triggerBranches);
  }
  if (parsed.data.config !== undefined) {
    updateData.config = JSON.stringify(parsed.data.config);
  }
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;

  await db
    .update(pipelines)
    .set(updateData)
    .where(eq(pipelines.id, pipelineId));

  const updated = await db
    .select({
      id: pipelines.id,
      teamId: pipelines.teamId,
      repositoryId: pipelines.repositoryId,
      name: pipelines.name,
      triggerMode: pipelines.triggerMode,
      triggerBranches: pipelines.triggerBranches,
      config: pipelines.config,
      status: pipelines.status,
      createdBy: pipelines.createdBy,
      createdAt: pipelines.createdAt,
      updatedAt: pipelines.updatedAt,
      repoName: repositories.name,
      repoFullName: repositories.fullName,
      repoDefaultBranch: repositories.defaultBranch,
    })
    .from(pipelines)
    .leftJoin(repositories, eq(pipelines.repositoryId, repositories.id))
    .where(eq(pipelines.id, pipelineId))
    .limit(1);

  return c.json(updated[0]);
});

// ============================================================
// DELETE /api/teams/:teamId/pipelines/:pipelineId — delete
// ============================================================
pipelineRoutes.delete("/:pipelineId", async (c) => {
  const teamId = c.get("teamId") as string;
  const pipelineId = c.req.param("pipelineId");

  const existing = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.teamId, teamId)))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "Pipeline not found" }, 404);
  }

  await db.delete(pipelines).where(eq(pipelines.id, pipelineId));

  return c.json({ success: true });
});

export default pipelineRoutes;
