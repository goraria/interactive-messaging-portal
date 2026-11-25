import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());
const { databaseUrl } = await import("@/utils/environment");

export default defineConfig({
  out: "./database/drizzle",
  schema: "./database/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
});
