import { readFile } from "node:fs/promises"
import nextEnv from "@next/env"
import postgres from "@gorth-com/structure/cores/postgres"

nextEnv.loadEnvConfig(process.cwd())
const { databaseUrl } = await import("../utils/environment.ts")
if (!databaseUrl) throw new Error("DATABASE_URL is required")
const database = postgres(databaseUrl, { max: 1, prepare: false })
async function domainSnapshot(transaction) {
  return transaction`SELECT
    (SELECT count(*) FROM public.conversation) AS conversation,
    (SELECT count(*) FROM public.message) AS message,
    (SELECT count(*) FROM public.conversation_member) AS member,
    (SELECT count(*) FROM public.message_attachment) AS attachment,
    (SELECT count(*) FROM public.message_reaction) AS reaction,
    (SELECT count(*) FROM public.message_receipt) AS receipt`
}
try {
  const migration = await readFile(
    new URL("../database/migrations/20261011-better-auth.sql", import.meta.url),
    "utf8"
  )
  const result = await database.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtextextended('gorth:better-auth-migration', 0))`
    const before = await transaction`SELECT id FROM public."user" ORDER BY id`
    const domainBefore = await domainSnapshot(transaction)
    await transaction.unsafe(migration)
    const after = await transaction`SELECT id FROM public."user" ORDER BY id`
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error("User identities changed; rollback")
    const missing =
      await transaction`SELECT count(*)::int AS count FROM public."user" u
      WHERE NOT EXISTS (SELECT 1 FROM public.account a WHERE a.user_id = u.id AND a.provider_id = 'gorth' AND a.account_id = u.external_user_id)`
    if (missing[0].count !== 0)
      throw new Error("Account bindings are incomplete; rollback")
    const domainAfter = await domainSnapshot(transaction)
    if (JSON.stringify(domainBefore) !== JSON.stringify(domainAfter))
      throw new Error("Chat data changed; rollback")
    return {
      usersPreserved: after.length,
      accountBindingsVerified: true,
      chatDataPreserved: true,
    }
  })
  console.log(JSON.stringify(result))
} catch {
  console.error(
    "Migration failed; transaction rolled back. No credentials logged."
  )
  process.exitCode = 1
} finally {
  await database.end()
}
