import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ============================================================
// Helper: UUID generation for SQLite (since SQLite has no native UUID type)
// We store UUIDs as text and gen them in app code.
// In postgres, these become uuid types — the schema is designed for
// PostgreSQL compatibility (Drizzle maps text → text in SQLite, uuid in PG)
// ============================================================

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
};

// ============================================================
// 1. users
// ============================================================
export const users = sqliteTable("users", {
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
export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(), // UUID
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("free"), // free | pro | enterprise
  ...timestamps,
});

// ============================================================
// 3. team_members
// ============================================================
export const teamMembers = sqliteTable("team_members", {
  id: text("id").primaryKey(), // UUID
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // owner | admin | member
  joinedAt: text("joined_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================================
// 4. repositories
// ============================================================
export const repositories = sqliteTable("repositories", {
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
  connectedAt: text("connected_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

// ============================================================
// 5. pipelines
// ============================================================
export const pipelines = sqliteTable("pipelines", {
  id: text("id").primaryKey(), // UUID
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  repositoryId: text("repository_id")
    .notNull()
    .references(() => repositories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  triggerMode: text("trigger_mode").notNull().default("manual"), // manual | push | pull_request
  triggerBranches: text("trigger_branches", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
  config: text("config", { mode: "json" }).$type<{ stages: any[] }>(),
  status: text("status").notNull().default("draft"), // active | paused | draft
  createdBy: text("created_by").references(() => users.id),
  ...timestamps,
});

// ============================================================
// 6. pipeline_runs
// ============================================================
export const pipelineRuns = sqliteTable("pipeline_runs", {
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
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================================
// 7. run_stages
// ============================================================
export const runStages = sqliteTable("run_stages", {
  id: text("id").primaryKey(), // UUID
  pipelineRunId: text("pipeline_run_id")
    .notNull()
    .references(() => pipelineRuns.id, { onDelete: "cascade" }),
  stageConfig: text("stage_config", { mode: "json" }).notNull(),
  order: integer("order").notNull(),
  status: text("status").notNull().default("pending"),
  logOutput: text("log_output"),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
});

// ============================================================
// 8. checkpoint_approvals
// ============================================================
export const checkpointApprovals = sqliteTable("checkpoint_approvals", {
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
  actedAt: text("acted_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================================
// 9. deployments
// ============================================================
export const deployments = sqliteTable("deployments", {
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
  deployedAt: text("deployed_at"),
});

// ============================================================
// 10. audit_logs
// ============================================================
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(), // UUID
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  metadata: text("metadata", { mode: "json" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================================
// 11. beta_signups (landing page email signups — no auth required)
// ============================================================
export const betaSignups = sqliteTable("beta_signups", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============================================================
// 12. notifications
// ============================================================
export const notifications = sqliteTable("notifications", {
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
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  actionUrl: text("action_url"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
