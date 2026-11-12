import { sql } from "drizzle-orm"
import { createRateLimitStore } from "@gorth-io/principle/modules/rate-limit"
import { getDatabase } from "@/database"

interface RateLimitRow extends Record<string, unknown> {
  count: number
  lastRequest: number
}

// SQL atomicity, cleanup and the persisted key namespace remain app-owned.
export function createDatabaseRateLimitStore() {
  const prefix = "hono:"
  let windowMs = 60_000
  let lastCleanupAt = 0
  const store = createRateLimitStore({
    prefix,
    storage: {
      async get(key: string, now: number) {
        const result = await getDatabase().execute<RateLimitRow>(sql`
      SELECT "count", "last_request" AS "lastRequest"
      FROM "rate_limit"
      WHERE "key" = ${key}
        AND "last_request" + ${windowMs} > ${now}
      LIMIT 1
    `)
        const row = result[0]
        return row
          ? {
              totalHits: Number(row.count),
              resetAt: Number(row.lastRequest) + windowMs,
            }
          : undefined
      },

      async increment({
        key,
        now,
        windowMs,
      }: {
        key: string
        now: number
        windowMs: number
      }) {
        if (now - lastCleanupAt >= 5 * 60_000) {
          lastCleanupAt = now
          await getDatabase().execute(sql`
        DELETE FROM "rate_limit"
        WHERE "key" LIKE ${`${prefix}%`}
          AND "last_request" + ${windowMs} <= ${now}
      `)
        }
        const result = await getDatabase().execute<RateLimitRow>(sql`
      INSERT INTO "rate_limit" ("key", "count", "last_request")
      VALUES (${key}, 1, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "rate_limit"."last_request" + ${windowMs} <= ${now}
            THEN 1
          ELSE "rate_limit"."count" + 1
        END,
        "last_request" = CASE
          WHEN "rate_limit"."last_request" + ${windowMs} <= ${now}
            THEN ${now}
          ELSE "rate_limit"."last_request"
        END
      RETURNING "count", "last_request" AS "lastRequest"
    `)
        const row = result[0]
        if (!row) throw new Error("rate_limit_increment_failed")
        return {
          totalHits: Number(row.count),
          resetAt: Number(row.lastRequest) + windowMs,
        }
      },

      async decrement(key: string) {
        await getDatabase().execute(sql`
      UPDATE "rate_limit"
      SET "count" = GREATEST("count" - 1, 0)
      WHERE "key" = ${key}
    `)
      },

      async resetKey(key: string) {
        await getDatabase().execute(sql`
      DELETE FROM "rate_limit" WHERE "key" = ${key}
    `)
      },
    },
  })
  return {
    ...store,
    init(options: { windowMs: number }) {
      store.init(options)
      windowMs = options.windowMs
    },
  }
}
