import { sql } from "drizzle-orm"
import type { DpopReplayStore } from "better-auth/oauth2"

import { database } from "@/database"

export const databaseDpopReplayStore: DpopReplayStore = {
  async reserve({ key, expiresAt, now }) {
    return database.transaction(async (transaction) => {
      await transaction.execute(sql`
        DELETE FROM "proof"
        WHERE "expires_at" <= ${now}
      `)
      const result = await transaction.execute<{ key: string }>(sql`
        INSERT INTO "proof" ("key", "expires_at")
        VALUES (${key}, ${expiresAt})
        ON CONFLICT ("key") DO NOTHING
        RETURNING "key"
      `)
      return result.rows.length === 1
    })
  },
}
