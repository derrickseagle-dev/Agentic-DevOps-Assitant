import { Hono } from "hono";
import { db } from "../db";
import { users, teamMembers, teams } from "../db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { signToken, signRefreshToken } from "../lib/jwt";
import { authMiddleware } from "../middleware/auth";

const authRoutes = new Hono();

// GET /auth/github — redirect to GitHub OAuth
authRoutes.get("/github", (c) => {
  const clientId = process.env.GITHUB_CLIENT_ID || "placeholder-client-id";
  const redirectUri = `${process.env.PUBLIC_APP_URL || "http://localhost:5173"}/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "user:email read:user",
    state: crypto.randomUUID(),
  });

  return c.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

// GET /auth/github/callback — handle OAuth callback
authRoutes.get("/github/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code) {
    return c.json({ error: "Missing authorization code" }, 400);
  }

  const clientId = process.env.GITHUB_CLIENT_ID || "placeholder-client-id";
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || "placeholder-client-secret";

  // Exchange code for access token
  let accessToken: string;
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${process.env.PUBLIC_APP_URL || "http://localhost:5173"}/auth/callback`,
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (tokenData.error || !tokenData.access_token) {
      console.error("[auth] GitHub token error:", tokenData);
      return c.json({ error: "Failed to authenticate with GitHub" }, 401);
    }
    accessToken = tokenData.access_token;
  } catch (err) {
    console.error("[auth] Token exchange failed:", err);
    return c.json({ error: "Failed to exchange GitHub code" }, 500);
  }

  // Fetch user info from GitHub
  let githubUser: {
    id: number;
    login: string;
    name: string;
    email: string;
    avatar_url: string;
  };
  try {
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    githubUser = (await userRes.json()) as typeof githubUser;

    if (!githubUser.id) {
      return c.json({ error: "Failed to fetch GitHub user" }, 500);
    }
  } catch (err) {
    console.error("[auth] User fetch failed:", err);
    return c.json({ error: "Failed to fetch GitHub user info" }, 500);
  }

  // Fetch user's primary email if not public
  let email = githubUser.email;
  if (!email) {
    try {
      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });
      const emails = (await emailRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary = emails.find((e) => e.primary && e.verified) || emails[0];
      if (primary) email = primary.email;
    } catch {
      // Email fetch is best-effort
    }
  }

  if (!email) {
    return c.json({ error: "Could not determine email from GitHub. Please make your email public." }, 400);
  }

  // Upsert user in database
  const now = new Date();
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.githubId, githubUser.id))
    .limit(1);

  let userId: string;

  if (existingUser.length > 0) {
    userId = existingUser[0].id;
    // Update user info and token
    await db
      .update(users)
      .set({
        email,
        name: githubUser.name || githubUser.login,
        avatarUrl: githubUser.avatar_url,
        githubToken: accessToken,
        updatedAt: now,
      })
      .where(eq(users.id, userId));
  } else {
    userId = uuidv4();
    await db.insert(users).values({
      id: userId,
      email,
      name: githubUser.name || githubUser.login,
      avatarUrl: githubUser.avatar_url,
      githubId: githubUser.id,
      githubToken: accessToken,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Check if user has a personal team — if not, create one
  const userMemberships = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));

  let defaultTeamId: string | undefined;

  if (userMemberships.length === 0) {
    // Create a default team for the user
    defaultTeamId = uuidv4();
    const slug = `team-${githubUser.login.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    await db.insert(teams).values({
      id: defaultTeamId,
      name: `${githubUser.login}'s Team`,
      slug,
      plan: "free",
      createdAt: now,
      updatedAt: now,
    });

    // Add user as owner
    await db.insert(teamMembers).values({
      id: uuidv4(),
      teamId: defaultTeamId,
      userId,
      role: "owner",
      joinedAt: now,
    });
    userMemberships.push({
      id: "",
      teamId: defaultTeamId,
      userId,
      role: "owner",
      joinedAt: now,
    });
  }

  // Sign JWT
  const token = signToken({ userId, teamId: userMemberships[0].teamId });
  const refreshToken = signRefreshToken(userId);

  // Return user info and tokens
  return c.json({
    user: {
      id: userId,
      email,
      name: githubUser.name || githubUser.login,
      avatarUrl: githubUser.avatar_url,
    },
    token,
    refreshToken,
    teams: userMemberships.map((m) => ({ teamId: m.teamId, role: m.role })),
  });
});

// GET /auth/me — return current user
authRoutes.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");

  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (user.length === 0) {
    return c.json({ error: "User not found" }, 404);
  }

  const memberships = await db
    .select({
      teamId: teamMembers.teamId,
      role: teamMembers.role,
      teamName: teams.name,
      teamSlug: teams.slug,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId));

  return c.json({
    id: user[0].id,
    email: user[0].email,
    name: user[0].name,
    avatarUrl: user[0].avatarUrl,
    teams: memberships,
  });
});

// POST /auth/logout
authRoutes.post("/logout", (c) => {
  return c.json({ success: true });
});

export default authRoutes;
