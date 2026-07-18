import { db } from "../db";
import {
  pipelineRuns,
  runStages,
  checkpointApprovals,
  deployments,
  users,
  repositories,
  pipelines,
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getGitHubToken } from "../lib/encryption";
import { Octokit } from "octokit";

// ============================================================
// Types
// ============================================================

export type RunStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "success"
  | "failed"
  | "cancelled";

export type StageStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "success"
  | "failed"
  | "skipped";

interface StageConfig {
  id: string;
  name: string;
  type: "script" | "checkpoint" | "deploy";
  command?: string;
  image?: string;
  environment?: string;
  approvers?: string[];
  message?: string;
  order: number;
}

interface PipelineConfig {
  stages: StageConfig[];
}

// ============================================================
// Create run stages from pipeline config
// ============================================================

export async function createRunStages(runId: string, config: PipelineConfig): Promise<void> {
  const now = new Date().toISOString();

  for (const stage of config.stages) {
    await db.insert(runStages).values({
      id: uuidv4(),
      pipelineRunId: runId,
      stageConfig: JSON.stringify(stage),
      order: stage.order,
      status: "pending",
      startedAt: null,
      finishedAt: null,
      logOutput: null,
    });
  }
}

// ============================================================
// Advance run to next stage
// ============================================================

async function advanceToNextStage(runId: string): Promise<void> {
  // Get the run
  const run = await db
    .select()
    .from(pipelineRuns)
    .where(eq(pipelineRuns.id, runId))
    .limit(1);

  if (run.length === 0) return;

  const currentRun = run[0];
  const nextOrder = currentRun.currentStageOrder + 1;

  // Get the next stage
  const nextStage = await db
    .select()
    .from(runStages)
    .where(
      and(
        eq(runStages.pipelineRunId, runId),
        eq(runStages.order, nextOrder)
      )
    )
    .limit(1);

  const now = new Date().toISOString();

  if (nextStage.length === 0) {
    // No more stages — run is complete!
    await db
      .update(pipelineRuns)
      .set({
        status: "success",
        finishedAt: now,
      })
      .where(eq(pipelineRuns.id, runId));

    // Update GitHub check run to success
    await updateGitHubCheckRun(runId, "success");
    return;
  }

  // Advance current_stage_order
  await db
    .update(pipelineRuns)
    .set({ currentStageOrder: nextOrder, status: "running" })
    .where(eq(pipelineRuns.id, runId));
}

// ============================================================
// Execute a single stage
// ============================================================

export async function executeStage(runStageId: string): Promise<void> {
  const stageRow = await db
    .select()
    .from(runStages)
    .where(eq(runStages.id, runStageId))
    .limit(1);

  if (stageRow.length === 0) return;

  const stage = stageRow[0];
  const stageConfig: StageConfig = JSON.parse(stage.stageConfig as string);
  const now = new Date().toISOString();
  const timestamp = now.replace("T", " ").substring(0, 19);

  // Mark stage as running
  await db
    .update(runStages)
    .set({ status: "running", startedAt: now })
    .where(eq(runStages.id, runStageId));

  // Find the parent run
  const run = await db
    .select()
    .from(pipelineRuns)
    .where(eq(pipelineRuns.id, stage.pipelineRunId))
    .limit(1);

  if (run.length === 0) return;
  const currentRun = run[0];

  // Update GitHub check run
  await updateGitHubCheckRun(currentRun.id, "in_progress");

  if (stageConfig.type === "checkpoint") {
    // ============================================================
    // CHECKPOINT: halt and await approval
    // ============================================================
    const logLine = `[${timestamp}] ⏸️  Checkpoint: ${stageConfig.name}
[${timestamp}]    Message: ${stageConfig.message || "Approval required"}
[${timestamp}]    Status: Awaiting approval...`;

    await db
      .update(runStages)
      .set({
        status: "awaiting_approval",
        logOutput: logLine,
      })
      .where(eq(runStages.id, runStageId));

    // Create checkpoint approval record
    const checkpointApprovalId = uuidv4();
    await db.insert(checkpointApprovals).values({
      id: checkpointApprovalId,
      runStageId,
      pipelineRunId: currentRun.id,
      approvedBy: null,
      status: "pending",
      comment: null,
      actedAt: null,
      createdAt: now,
    });

    // Pause the run
    await db
      .update(pipelineRuns)
      .set({ status: "awaiting_approval" })
      .where(eq(pipelineRuns.id, currentRun.id));

    // Send checkpoint notification to all approvers
    const { sendCheckpointNotification } = await import("./notifications");
    sendCheckpointNotification(checkpointApprovalId).catch(() => {
      // Best-effort
    });

    console.log(`[executor] Checkpoint reached: ${stageConfig.name} — run ${currentRun.id} paused`);
  } else if (stageConfig.type === "script") {
    // ============================================================
    // SCRIPT: simulate execution
    // ============================================================
    const logLines = [
      `[${timestamp}] 🚀 Starting: ${stageConfig.name}`,
      `[${timestamp}]    Image: ${stageConfig.image || "default"}`,
      `[${timestamp}]    Command: ${stageConfig.command || "(none)"}`,
      `[${timestamp}]    Executing...`,
      `[${timestamp}] ✅ Stage complete: ${stageConfig.name}`,
    ];

    // Simulate a brief delay for realism
    await new Promise((r) => setTimeout(r, 200));

    await db
      .update(runStages)
      .set({
        status: "success",
        logOutput: logLines.join("\n"),
        finishedAt: new Date().toISOString(),
      })
      .where(eq(runStages.id, runStageId));

    console.log(`[executor] Script stage complete: ${stageConfig.name} — run ${currentRun.id}`);

    // Advance to next stage
    await advanceToNextStage(currentRun.id);
  } else if (stageConfig.type === "deploy") {
    // ============================================================
    // DEPLOY: simulate deployment
    // ============================================================
    const env = stageConfig.environment || "production";
    const logLines = [
      `[${timestamp}] 🚀 Deploying to ${env}: ${stageConfig.name}`,
      `[${timestamp}]    Command: ${stageConfig.command || "(none)"}`,
      `[${timestamp}]    Deploying...`,
      `[${timestamp}] ✅ Deploy complete: ${stageConfig.name}`,
    ];

    // Simulate delay
    await new Promise((r) => setTimeout(r, 200));

    const deployFinishTime = new Date().toISOString();

    await db
      .update(runStages)
      .set({
        status: "success",
        logOutput: logLines.join("\n"),
        finishedAt: deployFinishTime,
      })
      .where(eq(runStages.id, runStageId));

    // Record deployment
    const deployId = uuidv4();
    await db.insert(deployments).values({
      id: deployId,
      pipelineRunId: currentRun.id,
      repositoryId: currentRun.repositoryId,
      environment: env,
      status: "success",
      deployUrl: null,
      deployedAt: deployFinishTime,
    });

    console.log(`[executor] Deploy stage complete: ${stageConfig.name} → ${env} — run ${currentRun.id}`);

    // Send deployment notification
    const { sendDeploymentNotification } = await import("./notifications");
    sendDeploymentNotification(deployId).catch(() => {
      // Best-effort
    });
    // Advance to next stage
    await advanceToNextStage(currentRun.id);
  }
}

// ============================================================
// Approve / Reject checkpoint
// ============================================================

export async function approveCheckpoint(
  runId: string,
  stageId: string,
  userId: string,
  comment?: string
): Promise<void> {
  const now = new Date().toISOString();

  // Update the checkpoint approval
  const approvalRows = await db
    .select()
    .from(checkpointApprovals)
    .where(
      and(
        eq(checkpointApprovals.pipelineRunId, runId),
        eq(checkpointApprovals.runStageId, stageId)
      )
    )
    .limit(1);

  if (approvalRows.length === 0) {
    throw new Error("Checkpoint approval not found");
  }

  await db
    .update(checkpointApprovals)
    .set({
      status: "approved",
      approvedBy: userId,
      comment: comment || null,
      actedAt: now,
    })
    .where(eq(checkpointApprovals.id, approvalRows[0].id));

  // Mark the stage as success
  const timestamp = now.replace("T", " ").substring(0, 19);
  const existingStage = await db
    .select()
    .from(runStages)
    .where(eq(runStages.id, stageId))
    .limit(1);

  const existingLog = existingStage[0]?.logOutput || "";
  const approvalLog = `[${timestamp}] ✅ Approved by user ${userId}${comment ? `: ${comment}` : ""}`;

  await db
    .update(runStages)
    .set({
      status: "success",
      logOutput: existingLog ? `${existingLog}\n${approvalLog}` : approvalLog,
      finishedAt: now,
    })
    .where(eq(runStages.id, stageId));

  // Set run back to running
  await db
    .update(pipelineRuns)
    .set({ status: "running" })
    .where(eq(pipelineRuns.id, runId));

  // Update GitHub check run
  await updateGitHubCheckRun(runId, "in_progress");

  // Advance to next stage
  await advanceToNextStage(runId);

  console.log(`[executor] Checkpoint approved for run ${runId}, stage ${stageId}`);
}

export async function rejectCheckpoint(
  runId: string,
  stageId: string,
  userId: string,
  comment?: string
): Promise<void> {
  const now = new Date().toISOString();

  // Update the checkpoint approval
  const approvalRows = await db
    .select()
    .from(checkpointApprovals)
    .where(
      and(
        eq(checkpointApprovals.pipelineRunId, runId),
        eq(checkpointApprovals.runStageId, stageId)
      )
    )
    .limit(1);

  if (approvalRows.length === 0) {
    throw new Error("Checkpoint approval not found");
  }

  await db
    .update(checkpointApprovals)
    .set({
      status: "rejected",
      approvedBy: userId,
      comment: comment || null,
      actedAt: now,
    })
    .where(eq(checkpointApprovals.id, approvalRows[0].id));

  // Mark the stage as failed
  const timestamp = now.replace("T", " ").substring(0, 19);
  const existingStage = await db
    .select()
    .from(runStages)
    .where(eq(runStages.id, stageId))
    .limit(1);

  const existingLog = existingStage[0]?.logOutput || "";
  const rejectionLog = `[${timestamp}] ❌ Rejected by user ${userId}${comment ? `: ${comment}` : ""}`;

  await db
    .update(runStages)
    .set({
      status: "failed",
      logOutput: existingLog ? `${existingLog}\n${rejectionLog}` : rejectionLog,
      finishedAt: now,
    })
    .where(eq(runStages.id, stageId));

  // Mark run as failed
  await db
    .update(pipelineRuns)
    .set({
      status: "failed",
      finishedAt: now,
    })
    .where(eq(pipelineRuns.id, runId));

  // Update GitHub check run
  await updateGitHubCheckRun(runId, "failure");

  console.log(`[executor] Checkpoint rejected for run ${runId}, stage ${stageId}`);
  // Send run failed notification
  const { sendRunFailedNotification } = await import("./notifications");
  sendRunFailedNotification(runId).catch(() => {
    // Best-effort
  });
}

// ============================================================
// Cancel a run
// ============================================================

export async function cancelRun(runId: string): Promise<void> {
  const now = new Date().toISOString();

  await db
    .update(pipelineRuns)
    .set({
      status: "cancelled",
      finishedAt: now,
    })
    .where(eq(pipelineRuns.id, runId));

  // Mark any running/pending stages as skipped
  await db
    .update(runStages)
    .set({ status: "skipped", finishedAt: now })
    .where(
      and(
        eq(runStages.pipelineRunId, runId),
        eq(runStages.status, "pending")
      )
    );

  // Update GitHub check run
  await updateGitHubCheckRun(runId, "cancelled");

  console.log(`[executor] Run ${runId} cancelled`);
}

// ============================================================
// GitHub Check Runs integration
// ============================================================

let githubWarningLogged = false;

async function getOctokitForRun(runId: string): Promise<{ octokit: Octokit; owner: string; repo: string; commitSha: string } | null> {
  try {
    const run = await db
      .select({
        pipelineId: pipelineRuns.pipelineId,
        repositoryId: pipelineRuns.repositoryId,
        commitSha: pipelineRuns.commitSha,
        triggeredBy: pipelineRuns.triggeredBy,
      })
      .from(pipelineRuns)
      .where(eq(pipelineRuns.id, runId))
      .limit(1);

    if (run.length === 0) return null;

    // Get the repo
    const repo = await db
      .select({
        fullName: repositories.fullName,
      })
      .from(repositories)
      .where(eq(repositories.id, run[0].repositoryId))
      .limit(1);

    if (repo.length === 0) return null;

    const [owner, repoName] = repo[0].fullName.split("/");
    if (!owner || !repoName) return null;

    // Get user's GitHub token
    if (!run[0].triggeredBy) return null;

    const user = await db
      .select({ githubToken: users.githubToken })
      .from(users)
      .where(eq(users.id, run[0].triggeredBy))
      .limit(1);

    if (user.length === 0 || !user[0].githubToken) return null;

    const token = getGitHubToken(user[0].githubToken);
    const octokit = new Octokit({ auth: token });

    return { octokit, owner, repo: repoName, commitSha: run[0].commitSha };
  } catch {
    return null;
  }
}

async function updateGitHubCheckRun(
  runId: string,
  conclusion: "in_progress" | "success" | "failure" | "cancelled"
): Promise<void> {
  try {
    const ctx = await getOctokitForRun(runId);
    if (!ctx) return;

    const { octokit, owner, repo, commitSha } = ctx;

    // Map status to GitHub Check Run status/conclusion
    let status: "queued" | "in_progress" | "completed" = "in_progress";
    let ghConclusion: "success" | "failure" | "cancelled" | "neutral" | null = null;

    switch (conclusion) {
      case "in_progress":
        status = "in_progress";
        break;
      case "success":
        status = "completed";
        ghConclusion = "success";
        break;
      case "failure":
        status = "completed";
        ghConclusion = "failure";
        break;
      case "cancelled":
        status = "completed";
        ghConclusion = "cancelled";
        break;
    }

    // We store the check run ID in memory for subsequent updates.
    // For beta, we use a simple key-value approach: store via the check run name.
    const checkRunName = `PipelineForge ${runId.substring(0, 8)}`;

    // Try to find existing check run
    const { data: existingRuns } = await octokit.rest.checks.listForRef({
      owner,
      repo,
      ref: commitSha,
      check_name: checkRunName,
      per_page: 1,
    });

    if (existingRuns.check_runs.length > 0) {
      // Update existing
      await octokit.rest.checks.update({
        owner,
        repo,
        check_run_id: existingRuns.check_runs[0].id,
        status,
        conclusion: ghConclusion as any,
      });
    } else {
      // Create new
      const runData = await db
        .select({
          status: pipelineRuns.status,
          branch: pipelineRuns.branch,
        })
        .from(pipelineRuns)
        .where(eq(pipelineRuns.id, runId))
        .limit(1);

      const runStatus = runData[0]?.status || "pending";

      await octokit.rest.checks.create({
        owner,
        repo,
        name: checkRunName,
        head_sha: commitSha,
        status,
        conclusion: ghConclusion as any,
        output: {
          title: `PipelineForge Run ${runId.substring(0, 8)}`,
          summary: `Run status: ${runStatus}\nBranch: ${runData[0]?.branch || "unknown"}`,
        },
      });
    }
  } catch (err: any) {
    if (!githubWarningLogged) {
      console.warn(
        "[executor] GitHub Check Runs not available (requires GitHub App or fine-grained token with checks:write). " +
        "Runs will proceed without GitHub status updates."
      );
      githubWarningLogged = true;
    }
  }
}

// ============================================================
// Worker: Process all running runs
// ============================================================

export async function processRunningRuns(): Promise<number> {
  const runs = await db
    .select()
    .from(pipelineRuns)
    .where(eq(pipelineRuns.status, "running"))
    .orderBy(pipelineRuns.createdAt);

  let processed = 0;

  for (const run of runs) {
    // Get the current stage
    const currentStage = await db
      .select()
      .from(runStages)
      .where(
        and(
          eq(runStages.pipelineRunId, run.id),
          eq(runStages.order, run.currentStageOrder)
        )
      )
      .limit(1);

    if (currentStage.length === 0) {
      // No stage at current order — run is complete
      const now = new Date().toISOString();
      await db
        .update(pipelineRuns)
        .set({ status: "success", finishedAt: now })
        .where(eq(pipelineRuns.id, run.id));
      await updateGitHubCheckRun(run.id, "success");
      continue;
    }

    const stage = currentStage[0];

    if (stage.status === "pending") {
      await executeStage(stage.id);
      processed++;
    } else if (stage.status === "awaiting_approval") {
      // Check if the checkpoint has been acted on
      const approval = await db
        .select()
        .from(checkpointApprovals)
        .where(
          and(
            eq(checkpointApprovals.pipelineRunId, run.id),
            eq(checkpointApprovals.runStageId, stage.id)
          )
        )
        .limit(1);

      if (approval.length === 0) {
        // No approval record? Create one.
        await db.insert(checkpointApprovals).values({
          id: uuidv4(),
          runStageId: stage.id,
          pipelineRunId: run.id,
          approvedBy: null,
          status: "pending",
          comment: null,
          actedAt: null,
          createdAt: new Date().toISOString(),
        });
      }
      // The run stays in awaiting_approval — don't advance until API call
    } else if (stage.status === "success" || stage.status === "skipped") {
      // Already complete, advance to next stage
      await advanceToNextStage(run.id);
      processed++;
    }
  }

  // Also check for runs in "awaiting_approval" — process any that got approved
  // (This is handled by the advanceToNextStage triggered via approveCheckpoint API)

  return processed;
}
