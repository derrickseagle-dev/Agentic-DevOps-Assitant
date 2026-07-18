import { Hono } from "hono";
import { db } from "../db";
import { teams, teamMembers, users, notifications } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { authMiddleware } from "../middleware/auth";
import { teamScopeMiddleware } from "../middleware/team-scope";
import { createTeamSchema, updateTeamSchema, inviteMemberSchema } from "../../../shared/src/schemas";

const teamRoutes = new Hono();

// All team routes require auth
teamRoutes.use("*", authMiddleware);

// ============================================================
// GET /api/teams — list user's teams
// ============================================================
teamRoutes.get("/", async (c) => {
  const userId = c.get("userId");

  const memberships = await db
    .select({
      teamId: teams.id,
      name: teams.name,
      slug: teams.slug,
      plan: teams.plan,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
      memberCount: db.$count(teamMembers, eq(teamMembers.teamId, teams.id)),
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId));

  return c.json({ teams: memberships });
});

// ============================================================
// POST /api/teams — create a team
// ============================================================
teamRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();

  const parsed = createTeamSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const { name, slug } = parsed.data;

  // Check slug uniqueness
  const existing = await db.select({ id: teams.id }).from(teams).where(eq(teams.slug, slug)).limit(1);
  if (existing.length > 0) {
    return c.json({ error: "A team with this slug already exists" }, 409);
  }

  const now = new Date().toISOString();
  const teamId = uuidv4();

  await db.insert(teams).values({
    id: teamId,
    name,
    slug,
    plan: "free",
    createdAt: now,
    updatedAt: now,
  });

  // Add creator as owner
  await db.insert(teamMembers).values({
    id: uuidv4(),
    teamId,
    userId,
    role: "owner",
    joinedAt: now,
  });

  return c.json(
    {
      id: teamId,
      name,
      slug,
      plan: "free",
      createdAt: now,
    },
    201,
  );
});

// ============================================================
// GET /api/teams/:teamId — get team details
// ============================================================
teamRoutes.get("/:teamId", teamScopeMiddleware, async (c) => {
  const teamId = c.req.param("teamId");

  const team = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);

  if (team.length === 0) {
    return c.json({ error: "Team not found" }, 404);
  }

  return c.json(team[0]);
});

// ============================================================
// PATCH /api/teams/:teamId — update team
// ============================================================
teamRoutes.patch("/:teamId", teamScopeMiddleware, async (c) => {
  const teamId = c.req.param("teamId");
  const userId = c.get("userId");

  // Only owner or admin can update
  const membership = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);

  if (membership.length === 0 || !["owner", "admin"].includes(membership[0].role)) {
    return c.json({ error: "Only team owners and admins can update the team" }, 403);
  }

  const body = await c.req.json();
  const parsed = updateTeamSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const updateData: Record<string, any> = { updatedAt: new Date().toISOString() };
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.plan !== undefined) updateData.plan = parsed.data.plan;

  await db.update(teams).set(updateData).where(eq(teams.id, teamId));

  const updated = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  return c.json(updated[0]);
});

// ============================================================
// GET /api/teams/:teamId/members — list members
// ============================================================
teamRoutes.get("/:teamId/members", teamScopeMiddleware, async (c) => {
  const teamId = c.req.param("teamId");

  const members = await db
    .select({
      id: teamMembers.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId));

  return c.json({ members });
});

// ============================================================
// POST /api/teams/:teamId/members — invite a member
// ============================================================
teamRoutes.post("/:teamId/members", teamScopeMiddleware, async (c) => {
  const teamId = c.req.param("teamId");
  const userId = c.get("userId");

  // Only owners and admins can invite
  const membership = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);

  if (membership.length === 0 || !["owner", "admin"].includes(membership[0].role)) {
    return c.json({ error: "Only team owners and admins can invite members" }, 403);
  }

  const body = await c.req.json();
  const parsed = inviteMemberSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const { email, role } = parsed.data;

  // Find user by email
  const targetUser = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (targetUser.length === 0) {
    // Stub: In production, we'd send an invitation email.
    // For now, we return a message saying the user needs to sign up first.
    return c.json({
      message: `Invitation would be sent to ${email}. User must sign in with GitHub first.`,
      pending: true,
    });
  }

  // Check if already a member
  const existing = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetUser[0].id)))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: "User is already a member of this team" }, 409);
  }

  const now = new Date().toISOString();
  const memberId = uuidv4();

  await db.insert(teamMembers).values({
    id: memberId,
    teamId,
    userId: targetUser[0].id,
    role,
    joinedAt: now,
  });

  // Create notification for the invited user
  await db.insert(notifications).values({
    id: uuidv4(),
    userId: targetUser[0].id,
    teamId,
    type: "member_invited",
    title: "Added to team",
    body: `You have been added to the team as ${role}.`,
    read: false,
    createdAt: now,
  });

  return c.json(
    {
      id: memberId,
      teamId,
      userId: targetUser[0].id,
      role,
      joinedAt: now,
    },
    201,
  );
});

// ============================================================
// DELETE /api/teams/:teamId/members/:memberUserId — remove member
// ============================================================
teamRoutes.delete("/:teamId/members/:memberUserId", teamScopeMiddleware, async (c) => {
  const teamId = c.req.param("teamId");
  const memberUserId = c.req.param("memberUserId");
  const currentUserId = c.get("userId");

  // Only owners and admins can remove, and owners cannot be removed
  const membership = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, currentUserId)))
    .limit(1);

  if (membership.length === 0 || !["owner", "admin"].includes(membership[0].role)) {
    return c.json({ error: "Only team owners and admins can remove members" }, 403);
  }

  // Check target's role
  const target = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, memberUserId)))
    .limit(1);

  if (target.length === 0) {
    return c.json({ error: "Member not found" }, 404);
  }

  if (target[0].role === "owner") {
    return c.json({ error: "Cannot remove the team owner" }, 403);
  }

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, memberUserId)));

  return c.json({ success: true });
});

export default teamRoutes;
