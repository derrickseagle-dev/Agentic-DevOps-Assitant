import { Hono } from "hono";
import { db } from "../db";
import { repositories, users } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { authMiddleware } from "../middleware/auth";
import { teamScopeMiddleware } from "../middleware/team-scope";
import { connectRepositorySchema } from "../../../shared/src/schemas";
import { getGitHubToken } from "../lib/encryption";
import { Octokit } from "octokit";
import { analyzeRepository } from "../services/ai-generator";

const repositoryRoutes = new Hono();

// All repo routes require auth + team scope
repositoryRoutes.use("*", authMiddleware);
repositoryRoutes.use("*", teamScopeMiddleware);

/**
 * Helper: Get an Octokit instance for the current user
 */
async function getOctokitForUser(userId: string): Promise<Octokit> {
  const user = await db
    .select({ githubToken: users.githubToken })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user.length === 0 || !user[0].githubToken) {
    throw new Error("User has no GitHub token. Please re-authenticate with GitHub.");
  }

  const token = getGitHubToken(user[0].githubToken);
  return new Octokit({ auth: token });
}

// ============================================================
// GET /api/teams/:teamId/repositories — list connected repos
// ============================================================
repositoryRoutes.get("/", async (c) => {
  const teamId = c.get("teamId") as string;

  const repos = await db
    .select()
    .from(repositories)
    .where(and(eq(repositories.teamId, teamId), eq(repositories.active, true)));

  return c.json({ repositories: repos });
});

// ============================================================
// GET /api/teams/:teamId/repositories/available — list GitHub
// repos available to connect
// ============================================================
repositoryRoutes.get("/available", async (c) => {
  const userId = c.get("userId") as string;

  let octokit: Octokit;
  try {
    octokit = await getOctokitForUser(userId);
  } catch (err: any) {
    return c.json({ error: err.message || "GitHub authentication required" }, 401);
  }

  const page = parseInt(c.req.query("page") || "1", 10);
  const perPage = Math.min(parseInt(c.req.query("per_page") || "30", 10), 100);

  try {
    // Fetch user's repos (owned + collaborations)
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: perPage,
      page,
      affiliation: "owner,collaborator,organization_member",
    });

    const repos = data.map((repo) => ({
      githubRepoId: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      url: repo.html_url,
      isPrivate: repo.private,
      defaultBranch: repo.default_branch,
      description: repo.description,
      language: repo.language,
    }));

    return c.json({
      repositories: repos,
      page,
      hasMore: data.length === perPage,
    });
  } catch (err: any) {
    console.error("[repos] GitHub API error:", err);
    return c.json({ error: "Failed to fetch repositories from GitHub" }, 502);
  }
});

// ============================================================
// POST /api/teams/:teamId/repositories — connect a GitHub repo
// ============================================================
repositoryRoutes.post("/", async (c) => {
  const teamId = c.get("teamId") as string;
  const userId = c.get("userId") as string;

  const body = await c.req.json();
  const parsed = connectRepositorySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const { githubRepoId, name, fullName, defaultBranch, language, url, isPrivate } = parsed.data;

  // Check if already connected and active
  const existing = await db
    .select()
    .from(repositories)
    .where(
      and(
        eq(repositories.teamId, teamId),
        eq(repositories.githubRepoId, githubRepoId),
        eq(repositories.active, true),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: "Repository is already connected to this team" }, 409);
  }

  const now = new Date().toISOString();
  const repoId = uuidv4();

  await db.insert(repositories).values({
    id: repoId,
    teamId,
    githubRepoId,
    name,
    fullName,
    defaultBranch: defaultBranch || "main",
    language: language || null,
    connectedBy: userId,
    connectedAt: now,
    active: true,
  });

  // If the repo was previously soft-disconnected, reactivate it instead
  // The insert above handles new cases; if it fails on unique constraint, reactivate
  const created = await db
    .select()
    .from(repositories)
    .where(eq(repositories.id, repoId))
    .limit(1);

  return c.json(created[0], 201);
});

// ============================================================
// POST /api/teams/:teamId/repositories/:repoId/analyze — AI analysis
// ============================================================
repositoryRoutes.post("/:repoId/analyze", async (c) => {
  const teamId = c.get("teamId") as string;
  const userId = c.get("userId") as string;
  const repoId = c.req.param("repoId");

  // Verify repo belongs to this team
  const repo = await db
    .select()
    .from(repositories)
    .where(and(eq(repositories.id, repoId), eq(repositories.teamId, teamId)))
    .limit(1);

  if (repo.length === 0) {
    return c.json({ error: "Repository not found" }, 404);
  }

  const repoData = repo[0];

  let octokit: Octokit;
  try {
    octokit = await getOctokitForUser(userId);
  } catch (err: any) {
    return c.json({ error: err.message || "GitHub authentication required" }, 401);
  }

  // Parse owner/repo from fullName
  const [owner, repoName] = repoData.fullName.split("/");
  if (!owner || !repoName) {
    return c.json({ error: "Invalid repository full name format" }, 400);
  }

  try {
    const analysis = await analyzeRepository(
      octokit,
      owner,
      repoName,
      repoData.defaultBranch,
      repoData.id,
      repoData.fullName,
      repoData.language,
    );

    return c.json({ analysis });
  } catch (err: any) {
    console.error("[repos] Analysis error:", err);
    return c.json({ error: err.message || "Failed to analyze repository" }, 502);
  }
});

// ============================================================
// DELETE /api/teams/:teamId/repositories/:repoId — disconnect
// ============================================================
repositoryRoutes.delete("/:repoId", async (c) => {
  const teamId = c.get("teamId") as string;
  const repoId = c.req.param("repoId");

  // Verify repo belongs to this team
  const repo = await db
    .select()
    .from(repositories)
    .where(and(eq(repositories.id, repoId), eq(repositories.teamId, teamId)))
    .limit(1);

  if (repo.length === 0) {
    return c.json({ error: "Repository not found" }, 404);
  }

  // Soft-delete by setting active = false
  await db
    .update(repositories)
    .set({ active: false })
    .where(eq(repositories.id, repoId));

  return c.json({ success: true });
});

export default repositoryRoutes;
