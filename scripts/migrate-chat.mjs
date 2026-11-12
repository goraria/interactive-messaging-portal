import nextEnv from "@next/env"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import postgres from "@gorth-io/structure/cores/postgres"
nextEnv.loadEnvConfig(fileURLToPath(new URL("../", import.meta.url)), true)
const { databaseUrl } = await import("../utils/environment.ts")
if (!databaseUrl) throw new Error("DATABASE_URL is required")
const client = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
  onnotice() {},
})
try {
  await client.begin(async (tx) => {
    const before =
      await tx`SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('user','session','account','verification','revocation','proof','rate_limit') ORDER BY table_name,ordinal_position`
    await tx.unsafe(
      await readFile(
        new URL(
          "../database/migrations/20261028-chat-completion.sql",
          import.meta.url
        ),
        "utf8"
      )
    )
    const after =
      await tx`SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('user','session','account','verification','revocation','proof','rate_limit') ORDER BY table_name,ordinal_position`
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error("Auth schema changed")
  })
  console.log("Chat domain migration applied; auth schema preserved.")
} catch (error) {
  console.error("Chat migration failed.", {
    code:
      typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code)
        ? error.code
        : "unknown",
  })
  process.exitCode = 1
} finally {
  await client.end()
}
