import { sql } from "drizzle-orm"
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

// App-local identity and auth storage. Better Auth remains owned by Gorth SSO.
export const userStatus = pgEnum("user_status", [
  "active",
  "inactive",
  "suspended",
  "deleted",
])

export const userTable = pgTable(
  "user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalUserId: text("external_user_id").notNull().unique(),
    name: text("name").notNull().default(""),
    username: varchar("username", { length: 64 }),
    role: varchar("role", { length: 32 }).notNull().default("user"),
    status: userStatus("status").notNull().default("active"),
    email: varchar("email", { length: 255 }).notNull().unique(),
    image: text("image"),
    banExpires: timestamp("ban_expires", { mode: "date", withTimezone: true }),
    bannedAt: timestamp("banned_at", { mode: "date", withTimezone: true }),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'::jsonb`),
    lastSeenAt: timestamp("last_seen_at", { mode: "date", withTimezone: true }),
    syncedAt: timestamp("synced_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("user_last_seen_at_idx").on(table.lastSeenAt),
    index("user_external_user_id_idx").on(table.externalUserId),
    index("user_status_idx").on(table.status),
    uniqueIndex("user_username_lower_key").on(sql`lower(${table.username})`),
  ]
)

// Only hashes of opaque session tokens; OAuth credentials are encrypted at rest.
export const sessionTable = pgTable(
  "session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    credentials: text("credentials"),
    ssoSessionId: text("sso_session_id"),
    userId: uuid("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("session_token_hash_unique").on(table.tokenHash),
    index("session_user_index").on(table.userId),
    index("session_sso_session_index").on(table.ssoSessionId),
    index("session_expires_idx").on(table.expiresAt),
  ]
)

// Single-use OAuth state hashes. Never persist plaintext PKCE verifiers here.
export const verificationTable = pgTable(
  "verification",
  {
    stateHash: text("state_hash").primaryKey(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [index("verification_expires_idx").on(table.expiresAt)]
)

// Signed logout receipts; sid may be absent for a subject-wide logout.
export const revocationTable = pgTable(
  "revocation",
  {
    jti: text("jti").primaryKey(),
    sid: text("sid"),
    subject: text("subject"),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("revocation_sid_idx").on(table.sid),
    index("revocation_expires_idx").on(table.expiresAt),
  ]
)

// Consumed DPoP proof keys, not the JWT/proof itself. Reservation must be atomic.
export const proofTable = pgTable(
  "proof",
  {
    key: text("key").primaryKey(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [index("proof_expires_idx").on(table.expiresAt)]
)
