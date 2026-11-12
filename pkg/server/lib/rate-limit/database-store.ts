import { sql } from "drizzle-orm"
import type { Store } from "@gorth/principle/cores/hono/rate-limiter"

import { database } from "@/database"

interface RateLimitRow extends Record<string, unknown> {
  count: number
  lastRequest: number
}

export class DatabaseRateLimitStore implements Store {
  readonly localKeys = false
  readonly prefix = "hono:"
  private windowMs = 60_000
  private lastCleanupAt = 0

  init(options: { windowMs: number }) {
    this.windowMs = options.windowMs
  }

  async get(key: string) {
    const now = Date.now()
    const result = await database.execute<RateLimitRow>(sql`
      SELECT "count", "last_request" AS "lastRequest"
      FROM "rate_limit"
      WHERE "key" = ${this.toKey(key)}
        AND "last_request" + ${this.windowMs} > ${now}
      LIMIT 1
    `)
    const row = result.rows[0]
    return row
      ? {
          totalHits: Number(row.count),
          resetTime: new Date(Number(row.lastRequest) + this.windowMs),
        }
      : undefined
  }

  async increment(key: string) {
    const now = Date.now()
    if (now - this.lastCleanupAt >= 5 * 60_000) {
      this.lastCleanupAt = now
      await database.execute(sql`
        DELETE FROM "rate_limit"
        WHERE "key" LIKE ${`${this.prefix}%`}
          AND "last_request" + ${this.windowMs} <= ${now}
      `)
    }
    const result = await database.execute<RateLimitRow>(sql`
      INSERT INTO "rate_limit" ("key", "count", "last_request")
      VALUES (${this.toKey(key)}, 1, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "rate_limit"."last_request" + ${this.windowMs} <= ${now}
            THEN 1
          ELSE "rate_limit"."count" + 1
        END,
        "last_request" = CASE
          WHEN "rate_limit"."last_request" + ${this.windowMs} <= ${now}
            THEN ${now}
          ELSE "rate_limit"."last_request"
        END
      RETURNING "count", "last_request" AS "lastRequest"
    `)
    const row = result.rows[0]
    if (!row) throw new Error("rate_limit_increment_failed")
    return {
      totalHits: Number(row.count),
      resetTime: new Date(Number(row.lastRequest) + this.windowMs),
    }
  }

  async decrement(key: string) {
    await database.execute(sql`
      UPDATE "rate_limit"
      SET "count" = GREATEST("count" - 1, 0)
      WHERE "key" = ${this.toKey(key)}
    `)
  }

  async resetKey(key: string) {
    await database.execute(sql`
      DELETE FROM "rate_limit" WHERE "key" = ${this.toKey(key)}
    `)
  }

  private toKey(key: string) {
    return `${this.prefix}${key}`
  }
}
