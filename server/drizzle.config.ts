import { defineConfig } from "drizzle-kit"
import dotenv from "dotenv"

import { databaseUrl } from "./lib/utils/environment"

dotenv.config({
  override: false,
  debug: false,
  quiet: true,
})

export default defineConfig({
  out: "./database/drizzle",
  schema: "./database/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl!,
  },
})
