import { parseDatabasePoolOptions } from "@gorth-com/structure/modules/database";
import "server-only";
import postgres from "@gorth-com/structure/cores/postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/database/schema";
import { databaseUrl, pgPoolMax } from "@/utils/environment";

function createDatabase() {
  if (!databaseUrl) throw new Error("missing_database_url");
  const max = Number.parseInt(pgPoolMax, 10);
  const client = postgres(
    parseDatabasePoolOptions({ connectionString: databaseUrl })
      .connectionString,
    {
      max: Number.isFinite(max) && max > 0 ? max : 5,
      prepare: false,
      connect_timeout: 10,
    },
  );
  return drizzle({ client });
}

export type Database = ReturnType<typeof createDatabase>;
const state = globalThis as typeof globalThis & { chatDatabase?: Database };

// Lazy initialization allows Next to build without connecting to a database.
export function getDatabase() {
  return (state.chatDatabase ??= createDatabase());
}

export { schema };
