import { pgTable, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

// ============================================================
// PostgreSQL schema for Neon / production
// Mirrors schema.ts (SQLite) with PG-native types:
//   integer {mode:"boolean"} → boolean
//   text {mode:"json"}       → jsonb
//   datetime('now')          → now()
// ============================================================

const timestamps = {
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
};

// ============================================================
// 1. users
// ============================================================
export const users = pgTable("users", {
  id: text("id").primaryKey(), // UUID
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  githubId: integer("github_id").unique(),
  githubToken: text("github_token"), // encrypted at rest
  ...timestamps,
});

// ============================================================
// 2. teams
// ============================================================
export const teams = pgTable("teams", {
  id: text("id").primaryKey(), // UUID
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("free"), // free | pro | enterprise
  ...timestamps,
});

// ============================================================
// 3. team_members
// ============================================================
export const teamMembers = pgTable("team_members", {
  id: text("id").primaryKey(), // UUID
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // owner | admin | member
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

// ============================================================
// 4. repositories
// ============================================================
export const repositories = pgTable("repositories", {
  id: text("id").primaryKey(), // UUID
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  githubRepoId: integer("github_repo_id").notNull(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull(),
  defaultBranch: text("default_branch").notNull().default("main"),
  language: text("language"),
  connectedBy: text("connected_by").references(() => users.id),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
  active: boolean("active").notNull().default(true),
});

// ============================================================
// 5. pipelines
// ============================================================
export const pipelines = pgTable("pipelines", {
  id: text("id").primaryKey(), // UUID
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  repositoryId: text("repository_id")
    .notNull()
    .references(() => repositories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  triggerMode: text("trigger_mode").notNull().default("manual"), // manual | push | pull_request
  triggerBranches: jsonb("trigger_branches").$type<string[]>().default([]),
  config: jsonb("config").$type<{ stages: any[] }>(),
  status: text("status").notNull().default("draft"), // active | paused | draft
  createdBy: text("created_by").references(() => users.id),
  ...timestamps,
});

// ============================================================
// 6. pipeline_runs
// ============================================================
export const pipelineRuns = pgTable("pipeline_runs", {
  id: text("id").primaryKey(), // UUID
  pipelineId: text("pipeline_id")
    .notNull()
    .references(() => pipelines.id, { onDelete: "cascade" }),
  repositoryId: text("repository_id")
    .notNull()
    .references(() => repositories.id),
  commitSha: text("commit_sha").notNull(),
  branch: text("branch").notNull(),
  commitMessage: text("commit_message"),
  trigger: text("trigger").notNull().default("manual"), // manual | push | pr
  triggeredBy: text("triggered_by").references(() => users.id),
  status: text("status").notNull().default("pending"),
  currentStageOrder: integer("current_stage_order").notNull().default(0),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================
// 7. run_stages
// ============================================================
export const runStages = pgTable("run_stages", {
  id: text("id").primaryKey(), // UUID
  pipelineRunId: text("pipeline_run_id")
    .notNull()
    .references(() => pipelineRuns.id, { onDelete: "cascade" }),
  stageConfig: jsonb("stage_config").notNull(),
  order: integer("order").notNull(),
  status: text("status").notNull().default("pending"),
  logOutput: text("log_output"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
});

// ============================================================
// 8. checkpoint_approvals
// ============================================================
export const checkpointApprovals = pgTable("checkpoint_approvals", {
  id: text("id").primaryKey(), // UUID
  runStageId: text("run_stage_id")
    .notNull()
    .references(() => runStages.id, { onDelete: "cascade" }),
  pipelineRunId: text("pipeline_run_id")
    .notNull()
    .references(() => pipelineRuns.id, { onDelete: "cascade" }),
  approvedBy: text("approved_by").references(() => users.id),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  comment: text("comment"),
  actedAt: timestamp("acted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================
// 9. deployments
// ============================================================
export const deployments = pgTable("deployments", {
  id: text("id").primaryKey(), // UUID
  pipelineRunId: text("pipeline_run_id")
    .notNull()
    .references(() => pipelineRuns.id, { onDelete: "cascade" }),
  repositoryId: text("repository_id")
    .notNull()
    .references(() => repositories.id),
  environment: text("environment").notNull(),
  status: text("status").notNull().default("pending"), // pending | success | failed
  deployUrl: text("deploy_url"),
  deployedAt: timestamp("deployed_at"),
});

// ============================================================
// 10. audit_logs
// ============================================================
export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(), // UUID
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================
// 11. beta_signups (landing page email signups — no auth required)
// ============================================================
export const betaSignups = pgTable("beta_signups", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================
// 12. notifications
// ============================================================
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(), // UUID
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  read: boolean("read").notNull().default(false),
  actionUrl: text("action_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
