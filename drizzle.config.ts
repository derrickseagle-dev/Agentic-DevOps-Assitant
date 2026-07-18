import type { Config } from "drizzle-kit";

export default {
  schema: "./src/backend/src/db/schema.ts",
  out: "./src/backend/src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "./pipelineforge.db",
  },
} satisfies Config;
