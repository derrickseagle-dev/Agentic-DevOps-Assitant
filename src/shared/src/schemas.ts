import { z } from "zod";

// ============================================================
// Auth schemas
// ============================================================
export const loginResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    avatarUrl: z.string(),
  }),
  token: z.string(),
});

// ============================================================
// Team schemas
// ============================================================
export const createTeamSchema = z.object({
  name: z.string().min(1, "Team name is required").max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  plan: z.enum(["free", "pro", "enterprise"]).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Valid email is required"),
  role: z.enum(["admin", "member"]).default("member"),
});

// ============================================================
// Pipeline stage schemas
// ============================================================
export const pipelineStageSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.enum(["script", "checkpoint", "deploy"]),
  command: z.string().optional(),
  image: z.string().optional(),
  environment: z.string().optional(),
  approvers: z.array(z.string()).optional(),
  message: z.string().optional(),
  order: z.number().int().min(0),
});

export const pipelineConfigSchema = z.object({
  stages: z.array(pipelineStageSchema),
});

// ============================================================
// Pipeline schemas
// ============================================================
export const createPipelineSchema = z.object({
  repositoryId: z.string().uuid(),
  name: z.string().min(1).max(200),
  triggerMode: z.enum(["manual", "push", "pull_request"]).default("manual"),
  triggerBranches: z.array(z.string()).default([]),
  config: pipelineConfigSchema,
});

export const updatePipelineSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  triggerMode: z.enum(["manual", "push", "pull_request"]).optional(),
  triggerBranches: z.array(z.string()).optional(),
  config: pipelineConfigSchema.optional(),
  status: z.enum(["active", "paused", "draft"]).optional(),
});

// ============================================================
// Repository schemas
// ============================================================
export const connectRepositorySchema = z.object({
  githubRepoId: z.number(),
  name: z.string().min(1),
  fullName: z.string().min(1),
  url: z.string().url().optional(),
  isPrivate: z.boolean().optional(),
  defaultBranch: z.string().default("main"),
  language: z.string().optional(),
});

// ============================================================
// Run schemas
// ============================================================
export const triggerRunSchema = z.object({
  branch: z.string().min(1),
  commitSha: z.string().optional(),
  commitMessage: z.string().optional(),
});

export const checkpointActionSchema = z.object({
  comment: z.string().optional(),
});

// ============================================================
// Dashboard schemas
// ============================================================
export const dashboardResponseSchema = z.object({
  activePipelines: z.number(),
  recentRuns: z.number(),
  pendingApprovals: z.number(),
  deploymentSuccessRate: z.number(),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type CreateTeam = z.infer<typeof createTeamSchema>;
export type UpdateTeam = z.infer<typeof updateTeamSchema>;
export type InviteMember = z.infer<typeof inviteMemberSchema>;
export type CreatePipeline = z.infer<typeof createPipelineSchema>;
export type UpdatePipeline = z.infer<typeof updatePipelineSchema>;
export type ConnectRepository = z.infer<typeof connectRepositorySchema>;
export type TriggerRun = z.infer<typeof triggerRunSchema>;
export type CheckpointAction = z.infer<typeof checkpointActionSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
