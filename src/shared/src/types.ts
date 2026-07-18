// Shared type definitions for PipelineForge
// Mirrors the data model in ARCHITECTURE.md Section 3

export type UserRole = "owner" | "admin" | "member";
export type TeamPlan = "free" | "pro" | "enterprise";
export type PipelineStatus = "active" | "paused" | "draft";
export type PipelineTriggerMode = "manual" | "push" | "pull_request";
export type RunStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "success"
  | "failed"
  | "cancelled";
export type StageStatus = "pending" | "running" | "awaiting_approval" | "success" | "failed" | "skipped";
export type StageType = "script" | "checkpoint" | "deploy";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type DeploymentStatus = "pending" | "success" | "failed";
export type NotificationType =
  | "checkpoint_pending"
  | "run_failed"
  | "deployment_complete"
  | "member_invited";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  githubId: number;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  plan: TeamPlan;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: UserRole;
  joinedAt: string;
  user?: User;
}

export interface PipelineStage {
  id: string;
  name: string;
  type: StageType;
  command?: string;
  image?: string;
  environment?: string;
  approvers?: string[];
  message?: string;
  order: number;
}

export interface PipelineConfig {
  stages: PipelineStage[];
}
