import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: process.env.DB?.startsWith("postgres") ? "postgresql" : "sqlite",
  dbCredentials: { url: process.env.DB! },
} satisfies Config;
