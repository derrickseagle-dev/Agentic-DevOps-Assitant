// Auto-detect: PostgreSQL (Neon) vs SQLite (local dev)
// This barrel re-exports the correct schema based on DATABASE_URL env var.
// All consumers import from "../db/schema" and get the right types at runtime.

const isPostgres =
  typeof process !== "undefined" &&
  process.env.DATABASE_URL?.startsWith("postgres");

// We use dynamic require-style loading so the unused adapter
// isn't imported at all (avoids bundling both drivers).
// At the TypeScript level, exports are typed as `any` because
// SQLiteTable and PgTable types are incompatible — consumers
// using the `db` instance (also typed as any) don't notice.
function loadSchema(): Record<string, any> {
  if (isPostgres) {
    return require("./schema.pg");
  }
  return require("./schema.sqlite");
}

const s = loadSchema();

export const users = s.users;
export const teams = s.teams;
export const teamMembers = s.teamMembers;
export const repositories = s.repositories;
export const pipelines = s.pipelines;
export const pipelineRuns = s.pipelineRuns;
export const runStages = s.runStages;
export const checkpointApprovals = s.checkpointApprovals;
export const deployments = s.deployments;
export const auditLogs = s.auditLogs;
export const betaSignups = s.betaSignups;
export const notifications = s.notifications;

// Export flag so db/index.ts knows which driver to use
export const usePostgres = isPostgres;
