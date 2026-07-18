import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { v4 as uuid } from "uuid";

const siteRoutes = new Hono();

const betaSignupSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
});

// POST /api/site/beta-signup — public, no auth required
siteRoutes.post("/site/beta-signup", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = betaSignupSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message || "Invalid email" }, 400);
    }

    const { email } = parsed.data;

    // Check if already signed up
    const existing = db
      .select()
      .from(schema.betaSignups)
      .where(eq(schema.betaSignups.email, email))
      .get();

    if (existing) {
      return c.json({ message: "You're already on the waitlist!", alreadySignedUp: true }, 200);
    }

    db.insert(schema.betaSignups).values({
      id: uuid(),
      email,
    }).run();

    return c.json({ message: "Thanks! We'll be in touch soon." }, 201);
  } catch (err) {
    console.error("[site] beta-signup error:", err);
    // Handle unique constraint violation gracefully
    if (err instanceof Error && err.message?.includes("UNIQUE constraint")) {
      return c.json({ message: "You're already on the waitlist!", alreadySignedUp: true }, 200);
    }
    return c.json({ error: "Something went wrong. Please try again." }, 500);
  }
});

export default siteRoutes;
