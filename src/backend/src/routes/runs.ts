import { Hono } from "hono";
import { db } from "../db";
import {
  pipelineRuns,
  runStages,
  checkpointApprovals,
  deployments,
  pipelines,
  repositories,
} from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { authMiddleware } from "../middleware/auth";
import { teamScopeMiddleware } from "../middleware/team-scope";
import { triggerRunSchema, checkpointActionSchema } from "../../../shared/src/schemas";
import {
  createRunStages,
  cancelRun,
  approveCheckpoint,
  rejectCheckpoint,
} from "../services/pipeline-executor";

const runRoutes = new Hono();

// All run routes require auth + team scope
runRoutes.use("*", authMiddleware);
runRoutes.use("*", teamScopeMiddleware);

// ============================================================
// GET /api/teams/:teamId/pipelines/:pipelineId/runs — list runs
// ============================================================
runRoutes.get("/:pipelineId/runs", async (c) => {
  const teamId = c.get("teamId") as string;
  const pipelineId = c.req.param("pipelineId");

  // Verify pipeline belongs to this team
  const pipe = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.teamId, teamId)))
    .limit(1);

  if (pipe.length === 0) {
    return c.json({ error: "Pipeline not found" }, 404);
  }

  const runs = await db
    .select({
      id: pipelineRuns.id,
      pipelineId: pipelineRuns.pipelineId,
      repositoryId: pipelineRuns.repositoryId,
      commitSha: pipelineRuns.commitSha,
      branch: pipelineRuns.branch,
      commitMessage: pipelineRuns.commitMessage,
      trigger: pipelineRuns.trigger,
      triggeredBy: pipelineRuns.triggeredBy,
      status: pipelineRuns.status,
      currentStageOrder: pipelineRuns.currentStageOrder,
      startedAt: pipelineRuns.startedAt,
      finishedAt: pipelineRuns.finishedAt,
      createdAt: pipelineRuns.createdAt,
    })
    .from(pipelineRuns)
    .where(eq(pipelineRuns.pipelineId, pipelineId))
    .orderBy(desc(pipelineRuns.createdAt))
    .limit(50);

  // For each run, count stages
  const runsWithCounts = await Promise.all(
    runs.map(async (run) => {
      const stages = await db
        .select()
        .from(runStages)
        .where(eq(runStages.pipelineRunId, run.id))
        .orderBy(runStages.order);

      const totalStages = stages.length;
      const passedStages = stages.filter((s) => s.status === "success").length;
      const failedStages = stages.filter((s) => s.status === "failed").length;

      return {
        ...run,
        totalStages,
        passedStages,
        failedStages,
      };
    })
  );

  return c.json({ runs: runsWithCounts });
});

// ============================================================
// POST /api/teams/:teamId/pipelines/:pipelineId/runs — trigger a run
// ============================================================
runRoutes.post("/:pipelineId/runs", async (c) => {
  const teamId = c.get("teamId") as string;
  const userId = c.get("userId") as string;
  const pipelineId = c.req.param("pipelineId");

  const body = await c.req.json();
  const parsed = triggerRunSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const { commitSha, branch, commitMessage } = parsed.data;

  // Use provided commitSha or default to "HEAD"
  const sha = commitSha || "HEAD";

  // Verify pipeline belongs to this team
  const pipe = await db
    .select({
      id: pipelines.id,
      repositoryId: pipelines.repositoryId,
      config: pipelines.config,
      status: pipelines.status,
    })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.teamId, teamId)))
    .limit(1);

  if (pipe.length === 0) {
    return c.json({ error: "Pipeline not found" }, 404);
  }

  if (pipe[0].status === "archived") {
    return c.json({ error: "Pipeline must be active to trigger runs" }, 400);
  }

  const config = pipe[0].config as any;
  if (!config?.stages || config.stages.length === 0) {
    return c.json({ error: "Pipeline has no stages defined" }, 400);
  }

  // Check if there's already a running/pending run for this pipeline
  const activeRun = await db
    .select({ id: pipelineRuns.id })
    .from(pipelineRuns)
    .where(
      and(
        eq(pipelineRuns.pipelineId, pipelineId),
        eq(pipelineRuns.status, "running")
      )
    )
    .limit(1);

  if (activeRun.length > 0) {
    return c.json(
      { error: "A run is already in progress for this pipeline" },
      409
    );
  }

  const now = new Date();
  const runId = uuidv4();

  // Create the pipeline run
  await db.insert(pipelineRuns).values({
    id: runId,
    pipelineId,
    repositoryId: pipe[0].repositoryId,
    commitSha: sha,
    branch,
    commitMessage: commitMessage || null,
    trigger: "manual",
    triggeredBy: userId,
    status: "running",
    currentStageOrder: 0,
    startedAt: now,
    finishedAt: null,
    createdAt: now,
  });

  // Create run stages from pipeline config
  await createRunStages(runId, config);

  // Get the created run with stages
  const created = await db
    .select()
    .from(pipelineRuns)
    .where(eq(pipelineRuns.id, runId))
    .limit(1);

  const stages = await db
    .select()
    .from(runStages)
    .where(eq(runStages.pipelineRunId, runId))
    .orderBy(runStages.order);

  return c.json(
    {
      run: {
        ...created[0],
        stages: stages.map((s) => ({
          ...s,
          stageConfig: s.stageConfig,
        })),
      },
    },
    201
  );
});

// ============================================================
// GET /api/teams/:teamId/pipelines/:pipelineId/runs/:runId — get run detail
// ============================================================
runRoutes.get("/:pipelineId/runs/:runId", async (c) => {
  const teamId = c.get("teamId") as string;
  const pipelineId = c.req.param("pipelineId");
  const runId = c.req.param("runId");

  // Verify pipeline belongs to this team
  const pipe = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.teamId, teamId)))
    .limit(1);

  if (pipe.length === 0) {
    return c.json({ error: "Pipeline not found" }, 404);
  }

  const run = await db
    .select()
    .from(pipelineRuns)
    .where(and(eq(pipelineRuns.id, runId), eq(pipelineRuns.pipelineId, pipelineId)))
    .limit(1);

  if (run.length === 0) {
    return c.json({ error: "Run not found" }, 404);
  }

  const stages = await db
    .select()
    .from(runStages)
    .where(eq(runStages.pipelineRunId, runId))
    .orderBy(runStages.order);

  const approvals = await db
    .select()
    .from(checkpointApprovals)
    .where(eq(checkpointApprovals.pipelineRunId, runId));

  const runDeployments = await db
    .select()
    .from(deployments)
    .where(eq(deployments.pipelineRunId, runId));

  return c.json({
    run: {
      ...run[0],
      stages: stages.map((s) => ({
        ...s,
        stageConfig: s.stageConfig,
      })),
      checkpointApprovals: approvals,
      deployments: runDeployments,
    },
  });
});

// ============================================================
// POST /api/teams/:teamId/pipelines/:pipelineId/runs/:runId/cancel — cancel
// ============================================================
runRoutes.post("/:pipelineId/runs/:runId/cancel", async (c) => {
  const teamId = c.get("teamId") as string;
  const pipelineId = c.req.param("pipelineId");
  const runId = c.req.param("runId");

  // Verify pipeline belongs to this team
  const pipe = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.teamId, teamId)))
    .limit(1);

  if (pipe.length === 0) {
    return c.json({ error: "Pipeline not found" }, 404);
  }

  const run = await db
    .select()
    .from(pipelineRuns)
    .where(and(eq(pipelineRuns.id, runId), eq(pipelineRuns.pipelineId, pipelineId)))
    .limit(1);

  if (run.length === 0) {
    return c.json({ error: "Run not found" }, 404);
  }

  if (run[0].status === "success" || run[0].status === "failed" || run[0].status === "cancelled") {
    return c.json({ error: `Cannot cancel a run that is already ${run[0].status}` }, 400);
  }

  await cancelRun(runId);

  return c.json({ success: true, status: "cancelled" });
});

// ============================================================
// POST /api/teams/:teamId/pipelines/:pipelineId/runs/:runId/approve — approve checkpoint
// ============================================================
runRoutes.post("/:pipelineId/runs/:runId/approve", async (c) => {
  const teamId = c.get("teamId") as string;
  const userId = c.get("userId") as string;
  const pipelineId = c.req.param("pipelineId");
  const runId = c.req.param("runId");

  // Verify pipeline belongs to this team
  const pipe = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.teamId, teamId)))
    .limit(1);

  if (pipe.length === 0) {
    return c.json({ error: "Pipeline not found" }, 404);
  }

  const run = await db
    .select()
    .from(pipelineRuns)
    .where(and(eq(pipelineRuns.id, runId), eq(pipelineRuns.pipelineId, pipelineId)))
    .limit(1);

  if (run.length === 0) {
    return c.json({ error: "Run not found" }, 404);
  }

  if (run[0].status !== "awaiting_approval") {
    return c.json({ error: "Run is not awaiting approval" }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = checkpointActionSchema.safeParse(body);
  const comment = parsed.success ? parsed.data.comment : undefined;

  // Find the current checkpoint stage
  const currentStage = await db
    .select()
    .from(runStages)
    .where(
      and(
        eq(runStages.pipelineRunId, runId),
        eq(runStages.order, run[0].currentStageOrder),
        eq(runStages.status, "awaiting_approval")
      )
    )
    .limit(1);

  if (currentStage.length === 0) {
    return c.json({ error: "No checkpoint stage found awaiting approval" }, 400);
  }

  await approveCheckpoint(runId, currentStage[0].id, userId, comment);

  return c.json({ success: true, status: "approved" });
});

// ============================================================
// POST /api/teams/:teamId/pipelines/:pipelineId/runs/:runId/reject — reject checkpoint
// ============================================================
runRoutes.post("/:pipelineId/runs/:runId/reject", async (c) => {
  const teamId = c.get("teamId") as string;
  const userId = c.get("userId") as string;
  const pipelineId = c.req.param("pipelineId");
  const runId = c.req.param("runId");

  // Verify pipeline belongs to this team
  const pipe = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.teamId, teamId)))
    .limit(1);

  if (pipe.length === 0) {
    return c.json({ error: "Pipeline not found" }, 404);
  }

  const run = await db
    .select()
    .from(pipelineRuns)
    .where(and(eq(pipelineRuns.id, runId), eq(pipelineRuns.pipelineId, pipelineId)))
    .limit(1);

  if (run.length === 0) {
    return c.json({ error: "Run not found" }, 404);
  }

  if (run[0].status !== "awaiting_approval") {
    return c.json({ error: "Run is not awaiting approval" }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = checkpointActionSchema.safeParse(body);
  const comment = parsed.success ? parsed.data.comment : undefined;

  // Find the current checkpoint stage
  const currentStage = await db
    .select()
    .from(runStages)
    .where(
      and(
        eq(runStages.pipelineRunId, runId),
        eq(runStages.order, run[0].currentStageOrder),
        eq(runStages.status, "awaiting_approval")
      )
    )
    .limit(1);

  if (currentStage.length === 0) {
    return c.json({ error: "No checkpoint stage found awaiting approval" }, 400);
  }

  await rejectCheckpoint(runId, currentStage[0].id, userId, comment);

  return c.json({ success: true, status: "rejected" });
});

export default runRoutes;
