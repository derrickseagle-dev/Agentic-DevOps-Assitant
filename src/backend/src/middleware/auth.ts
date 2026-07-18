import type { Context, Next } from "hono";
import { verifyToken } from "../lib/jwt";

// Extend Hono's Context to include userId and teamId
declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    teamId?: string;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);
    c.set("userId", payload.userId);
    if (payload.teamId) {
      c.set("teamId", payload.teamId);
    }
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

// Optional auth — attaches user if token present, but doesn't require it
export async function optionalAuth(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = verifyToken(token);
      c.set("userId", payload.userId);
      if (payload.teamId) {
        c.set("teamId", payload.teamId);
      }
    } catch {
      // Ignore invalid tokens in optional auth
    }
  }

  await next();
}
