import "server-only"
import { sql } from "drizzle-orm"
import { createAtomicDpopReplayStore } from "@gorth-io/structure/modules/auth/server"

import { getDatabase } from "@/database"

export const databaseDpopReplayStore = createAtomicDpopReplayStore({
  async reserve({ key, expiresAt, now }) {
    return getDatabase().transaction(async (transaction) => {
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
      return result.length === 1
    })
  },
})
