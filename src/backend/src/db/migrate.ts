// Run migrations on startup — auto-detects SQLite vs PostgreSQL (Neon)

const isPostgres =
  typeof process !== "undefined" &&
  process.env.DATABASE_URL?.startsWith("postgres");

async function runMigrations() {
  if (isPostgres) {
    await runPostgresMigrations();
  } else {
    runSqliteMigrations();
  }
}

// ============================================================
// PostgreSQL migrations (Neon)
// ============================================================
async function runPostgresMigrations() {
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

  console.log("[db] Running PostgreSQL migrations...");

  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      avatar_url TEXT,
      github_id INTEGER UNIQUE,
      github_token TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL DEFAULT 'free',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS repositories (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      github_repo_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      default_branch TEXT NOT NULL DEFAULT 'main',
      language TEXT,
      connected_by TEXT REFERENCES users(id),
      connected_at TIMESTAMP NOT NULL DEFAULT NOW(),
      active BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS pipelines (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      trigger_mode TEXT NOT NULL DEFAULT 'manual',
      trigger_branches JSONB DEFAULT '[]'::jsonb,
      config JSONB,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id TEXT PRIMARY KEY,
      pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
      repository_id TEXT NOT NULL REFERENCES repositories(id),
      commit_sha TEXT NOT NULL,
      branch TEXT NOT NULL,
      commit_message TEXT,
      trigger TEXT NOT NULL DEFAULT 'manual',
      triggered_by TEXT REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      current_stage_order INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMP,
      finished_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS run_stages (
      id TEXT PRIMARY KEY,
      pipeline_run_id TEXT NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
      stage_config JSONB NOT NULL,
      "order" INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      log_output TEXT,
      started_at TIMESTAMP,
      finished_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS checkpoint_approvals (
      id TEXT PRIMARY KEY,
      run_stage_id TEXT NOT NULL REFERENCES run_stages(id) ON DELETE CASCADE,
      pipeline_run_id TEXT NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
      approved_by TEXT REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      comment TEXT,
      acted_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      pipeline_run_id TEXT NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
      repository_id TEXT NOT NULL REFERENCES repositories(id),
      environment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      deploy_url TEXT,
      deployed_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      action_url TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS beta_signups (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  try {
    await pool.query(sql);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
      CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_repositories_team ON repositories(team_id);
      CREATE INDEX IF NOT EXISTS idx_pipelines_team ON pipelines(team_id);
      CREATE INDEX IF NOT EXISTS idx_pipelines_repo ON pipelines(repository_id);
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_pipeline ON pipeline_runs(pipeline_id);
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_repo ON pipeline_runs(repository_id);
      CREATE INDEX IF NOT EXISTS idx_run_stages_run ON run_stages(pipeline_run_id);
      CREATE INDEX IF NOT EXISTS idx_checkpoint_approvals_run ON checkpoint_approvals(pipeline_run_id);
      CREATE INDEX IF NOT EXISTS idx_deployments_repo ON deployments(repository_id);
      CREATE INDEX IF NOT EXISTS idx_deployments_pipeline_run ON deployments(pipeline_run_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_team ON audit_logs(team_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
      CREATE INDEX IF NOT EXISTS idx_notifications_team ON notifications(team_id);
    `);

    console.log("[db] PostgreSQL migrations complete.");
  } catch (err) {
    console.error("[db] PostgreSQL migration failed:", err);
  } finally {
    await pool.end();
  }
}

// ============================================================
// SQLite migrations (local dev)
// ============================================================
function runSqliteMigrations() {
  const { Database } = require("bun:sqlite");
  const sqlite = new Database("pipelineforge.db");
  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("PRAGMA foreign_keys = ON");

  console.log("[db] Running SQLite migrations...");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      avatar_url TEXT,
      github_id INTEGER UNIQUE,
      github_token TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL DEFAULT 'free',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS repositories (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      github_repo_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      default_branch TEXT NOT NULL DEFAULT 'main',
      language TEXT,
      connected_by TEXT REFERENCES users(id),
      connected_at TEXT NOT NULL DEFAULT (datetime('now')),
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS pipelines (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      trigger_mode TEXT NOT NULL DEFAULT 'manual',
      trigger_branches TEXT DEFAULT '[]',
      config TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id TEXT PRIMARY KEY,
      pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
      repository_id TEXT NOT NULL REFERENCES repositories(id),
      commit_sha TEXT NOT NULL,
      branch TEXT NOT NULL,
      commit_message TEXT,
      trigger TEXT NOT NULL DEFAULT 'manual',
      triggered_by TEXT REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      current_stage_order INTEGER NOT NULL DEFAULT 0,
      started_at TEXT,
      finished_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS run_stages (
      id TEXT PRIMARY KEY,
      pipeline_run_id TEXT NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
      stage_config TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      log_output TEXT,
      started_at TEXT,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS checkpoint_approvals (
      id TEXT PRIMARY KEY,
      run_stage_id TEXT NOT NULL REFERENCES run_stages(id) ON DELETE CASCADE,
      pipeline_run_id TEXT NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
      approved_by TEXT REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      comment TEXT,
      acted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      pipeline_run_id TEXT NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
      repository_id TEXT NOT NULL REFERENCES repositories(id),
      environment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      deploy_url TEXT,
      deployed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      action_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS beta_signups (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_repositories_team ON repositories(team_id);
    CREATE INDEX IF NOT EXISTS idx_pipelines_team ON pipelines(team_id);
    CREATE INDEX IF NOT EXISTS idx_pipelines_repo ON pipelines(repository_id);
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_pipeline ON pipeline_runs(pipeline_id);
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_repo ON pipeline_runs(repository_id);
    CREATE INDEX IF NOT EXISTS idx_run_stages_run ON run_stages(pipeline_run_id);
    CREATE INDEX IF NOT EXISTS idx_checkpoint_approvals_run ON checkpoint_approvals(pipeline_run_id);
    CREATE INDEX IF NOT EXISTS idx_deployments_repo ON deployments(repository_id);
    CREATE INDEX IF NOT EXISTS idx_deployments_pipeline_run ON deployments(pipeline_run_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_team ON audit_logs(team_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
    CREATE INDEX IF NOT EXISTS idx_notifications_team ON notifications(team_id);
  `);

  sqlite.close();
  console.log("[db] SQLite migrations complete.");
}

runMigrations();
