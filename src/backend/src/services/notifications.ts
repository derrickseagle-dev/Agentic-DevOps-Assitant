/**
 * PipelineForge — Notification Service
 *
 * Stub functions that log to console. Real email delivery via Resend in M6.
 * All functions insert into the `notifications` table for in-app display.
 *
 * Architecture:
 * - Stub functions log to console with structured prefixes
 * - Real implementation will call Resend API and use React Email templates
 * - Designed for easy swap: replace console.log with resend.emails.send()
 */

import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { notifications, checkpointApprovals, pipelineRuns, deployments, runStages, pipelines, repositories, users } from "../db/schema";
import { eq, and } from "drizzle-orm";

// ============================================================
// Notification types
// ============================================================

export type NotificationType =
  | "checkpoint_pending"
  | "run_failed"
  | "deployment_complete";

// ============================================================
// sendCheckpointNotification
// Called when a checkpoint stage is reached and paused.
// Notifies each approver.
// ============================================================
export async function sendCheckpointNotification(
  approvalId: string
): Promise<void> {
  try {
    // Load the approval with related data
    const approvalRows = await db
      .select({
        approvalId: checkpointApprovals.id,
        runStageId: checkpointApprovals.runStageId,
        pipelineRunId: checkpointApprovals.pipelineRunId,
        stageConfig: runStages.stageConfig,
        runStatus: pipelineRuns.status,
        pipelineName: pipelines.name,
        pipelineId: pipelines.id,
        repositoryName: repositories.name,
        triggeredBy: pipelineRuns.triggeredBy,
      })
      .from(checkpointApprovals)
      .innerJoin(runStages, eq(runStages.id, checkpointApprovals.runStageId))
      .innerJoin(pipelineRuns, eq(pipelineRuns.id, checkpointApprovals.pipelineRunId))
      .innerJoin(pipelines, eq(pipelines.id, pipelineRuns.pipelineId))
      .innerJoin(repositories, eq(repositories.id, pipelineRuns.repositoryId))
      .where(eq(checkpointApprovals.id, approvalId))
      .limit(1);

    if (approvalRows.length === 0) return;

    const data = approvalRows[0];
    const stageConfig = JSON.parse(data.stageConfig as string);
    const approvers: string[] = stageConfig.approvers || [];

    // Get the pipeline's team_id for notification scoping
    const pipelineRow = await db
      .select({ teamId: pipelines.teamId })
      .from(pipelines)
      .where(eq(pipelines.id, data.pipelineId))
      .limit(1);

    const teamId = pipelineRow[0]?.teamId || "";

    const now = new Date();
    const title = `Approval required: ${stageConfig.name}`;
    const body =
      stageConfig.message ||
      `Pipeline "${data.pipelineName}" requires your approval for "${stageConfig.name}" on ${data.repositoryName}.`;

    // Create notification for each approver
    for (const approverId of approvers) {
      await db.insert(notifications).values({
        id: uuidv4(),
        userId: approverId,
        teamId,
        type: "checkpoint_pending",
        title,
        body,
        read: false,
        actionUrl: `/pipelines/${data.pipelineId}/runs/${data.pipelineRunId}`,
        createdAt: now,
      });

      // Stub: log to console — real Resend call here in M6
      console.log(`[notifications] ✉️ CHECKPOINT_PENDING → ${approverId}: "${title}"`);
    }
  } catch (err) {
    // Notifications are best-effort; never throw
    console.error("[notifications] Error sending checkpoint notification:", err);
  }
}

// ============================================================
// sendRunFailedNotification
// Called when a pipeline run fails (any reason: stage failure, rejection, etc.)
// Notifies the pipeline owner / triggerer.
// ============================================================
export async function sendRunFailedNotification(
  runId: string
): Promise<void> {
  try {
    const runRows = await db
      .select({
        runId: pipelineRuns.id,
        branch: pipelineRuns.branch,
        commitSha: pipelineRuns.commitSha,
        triggeredBy: pipelineRuns.triggeredBy,
        status: pipelineRuns.status,
        pipelineName: pipelines.name,
        pipelineId: pipelines.id,
        repositoryName: repositories.name,
        teamId: pipelines.teamId,
      })
      .from(pipelineRuns)
      .innerJoin(pipelines, eq(pipelines.id, pipelineRuns.pipelineId))
      .innerJoin(repositories, eq(repositories.id, pipelineRuns.repositoryId))
      .where(eq(pipelineRuns.id, runId))
      .limit(1);

    if (runRows.length === 0) return;

    const data = runRows[0];
    if (!data.triggeredBy) return; // No one to notify

    const now = new Date();
    const title = `Pipeline failed: ${data.pipelineName}`;
    const body = `Pipeline "${data.pipelineName}" failed on ${data.repositoryName} (${data.branch} / ${data.commitSha?.substring(0, 7)}).`;

    await db.insert(notifications).values({
      id: uuidv4(),
      userId: data.triggeredBy,
      teamId: data.teamId,
      type: "run_failed",
      title,
      body,
      read: false,
      actionUrl: `/pipelines/${data.pipelineId}/runs/${runId}`,
      createdAt: now,
    });

    console.log(`[notifications] ✉️ RUN_FAILED → ${data.triggeredBy}: "${title}"`);
  } catch (err) {
    console.error("[notifications] Error sending run failed notification:", err);
  }
}

// ============================================================
// sendDeploymentNotification
// Called when a deployment completes (success or failure).
// Notifies the pipeline owner / triggerer.
// ============================================================
export async function sendDeploymentNotification(
  deploymentId: string
): Promise<void> {
  try {
    const deployRows = await db
      .select({
        deploymentId: deployments.id,
        environment: deployments.environment,
        status: deployments.status,
        deployUrl: deployments.deployUrl,
        pipelineRunId: deployments.pipelineRunId,
        triggeredBy: pipelineRuns.triggeredBy,
        pipelineName: pipelines.name,
        pipelineId: pipelines.id,
        repositoryName: repositories.name,
        branch: pipelineRuns.branch,
        teamId: pipelines.teamId,
      })
      .from(deployments)
      .innerJoin(pipelineRuns, eq(pipelineRuns.id, deployments.pipelineRunId))
      .innerJoin(pipelines, eq(pipelines.id, pipelineRuns.pipelineId))
      .innerJoin(repositories, eq(repositories.id, deployments.repositoryId))
      .where(eq(deployments.id, deploymentId))
      .limit(1);

    if (deployRows.length === 0) return;

    const data = deployRows[0];
    if (!data.triggeredBy) return;

    const now = new Date();
    const envLabel = data.environment || "production";
    const isSuccess = data.status === "success";
    const title = isSuccess
      ? `Deployed to ${envLabel}: ${data.pipelineName}`
      : `Deployment failed to ${envLabel}: ${data.pipelineName}`;
    const body = isSuccess
      ? `Successfully deployed "${data.pipelineName}" to ${envLabel} on ${data.repositoryName} (${data.branch}).`
      : `Deployment of "${data.pipelineName}" to ${envLabel} failed on ${data.repositoryName} (${data.branch}).`;

    await db.insert(notifications).values({
      id: uuidv4(),
      userId: data.triggeredBy,
      teamId: data.teamId,
      type: "deployment_complete",
      title,
      body,
      read: false,
      actionUrl: `/pipelines/${data.pipelineId}/runs/${data.pipelineRunId}`,
      createdAt: now,
    });

    console.log(`[notifications] ✉️ DEPLOYMENT_COMPLETE → ${data.triggeredBy}: "${title}"`);
  } catch (err) {
    console.error("[notifications] Error sending deployment notification:", err);
  }
}
