// import "dotenv/config"
import dotenv from "dotenv"
// @ts-ignore
import { Pool } from "@gorth/structure/cores/pg"
import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "@/database/schema"

dotenv.config({
  path: ".env.local",
  override: true,
  debug: false,
  quiet: true,
})

// const database = drizzle(process.env.DATABASE_URL!)

const databaseUrl = process.env.DATABASE_URL
const defaultPoolMax = 5
const poolMax = Number.parseInt(
  process.env.PG_POOL_MAX ?? `${defaultPoolMax}`,
  10
)

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
export const database = drizzle(pool, { schema })

export type Database = typeof database

export { schema }
export default database
