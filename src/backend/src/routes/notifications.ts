/**
 * PipelineForge — Notification Routes
 *
 * Endpoints:
 *   GET  /api/teams/:teamId/notifications          — list current user's notifications
 *   PATCH /api/teams/:teamId/notifications/:id/read — mark as read
 */

import { Hono } from "hono";
import { db } from "../db";
import { notifications } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import { teamScopeMiddleware } from "../middleware/team-scope";

const notificationRoutes = new Hono();

notificationRoutes.use("*", authMiddleware);
notificationRoutes.use("/:teamId/*", teamScopeMiddleware);

// ============================================================
// GET /api/teams/:teamId/notifications
// List notifications for the current user, newest first
// ============================================================
notificationRoutes.get("/:teamId/notifications", async (c) => {
  const teamId = c.get("teamId") as string;
  const userId = c.get("userId") as string;

  const result = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.teamId, teamId),
        eq(notifications.userId, userId)
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const unreadCount = result.filter((n) => !n.read).length;

  return c.json({
    notifications: result,
    unreadCount,
  });
});

// ============================================================
// PATCH /api/teams/:teamId/notifications/:notificationId/read
// Mark a notification as read
// ============================================================
notificationRoutes.patch("/:teamId/notifications/:notificationId/read", async (c) => {
  const teamId = c.get("teamId") as string;
  const userId = c.get("userId") as string;
  const notificationId = c.req.param("notificationId");

  // Verify the notification belongs to this user and team
  const existing = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
        eq(notifications.teamId, teamId)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "Notification not found" }, 404);
  }

  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, notificationId));

  return c.json({ success: true });
});

export default notificationRoutes;
