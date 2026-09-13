// @ts-ignore
import { Pool } from "@gorth/structure/cores/pg"
import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "@/database/schema"
import { databaseUrl, pgPoolMax } from "@/lib/utils/environment"

const defaultPoolMax = 5
const poolMax = Number.parseInt(pgPoolMax, 10)

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required")
}

const globalForDatabase = globalThis as typeof globalThis & {
  pgPool?: Pool
}

const sharedPool =
  globalForDatabase.pgPool ??
  new Pool({
    connectionString: databaseUrl,
    max: Number.isNaN(poolMax) ? defaultPoolMax : poolMax,
  })

if (!globalForDatabase.pgPool) {
  sharedPool.on("error", (error: any) => {
    console.error("[pg-pool-error]", error)
  })

  globalForDatabase.pgPool = sharedPool
}

export const pool = globalForDatabase.pgPool
export const database = drizzle({ client: pool })

export type Database = typeof database

export { schema }
export default database
