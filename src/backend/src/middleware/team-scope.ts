import type { Context, Next } from "hono";
import { db } from "../db";
import { teamMembers } from "../db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Team-scoping middleware.
 * Ensures the authenticated user belongs to the team specified in the URL param :teamId.
 * Sets c.set('teamId') for downstream handlers.
 *
 * Must be used AFTER authMiddleware.
 */
export async function teamScopeMiddleware(c: Context, next: Next) {
  const teamId = c.req.param("teamId");
  const userId = c.get("userId");

  if (!teamId) {
    return c.json({ error: "Team ID is required" }, 400);
  }

  // Check membership
  const member = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);

  if (member.length === 0) {
    return c.json({ error: "You are not a member of this team" }, 403);
  }

  c.set("teamId", teamId);
  await next();
}
