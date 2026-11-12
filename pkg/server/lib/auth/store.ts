import postgres from "@gorth/structure/cores/postgres"
import {
  AuthError,
  createAuthFreshnessPolicy,
  oauthCredentialsSchema,
  type AuthIdentity,
  type AuthPolicy,
  type IdentityAdapter,
  type LoginStorage,
  type LogoutStorage,
  type ProofStorage,
  type SessionStorage,
  type SessionCredentials,
  type StoredSession,
} from "@gorth/structure/modules/auth/server"
import { z } from "@gorth/structure/cores/zod"
import { formatSessionCredentials } from "@gorth/structure/utils/formatter"

export interface AuthAccount {
  id: string
  externalUserId: string
  name: string
  email: string
  username: string | null
  image: string | null
  role: string
  status: string
  bannedAt: Date | null
  deletedAt: Date | null
}
const recordSchema = z.object({
  key: z.string(),
  revision: z.string(),
  binding: z.string(),
  subject: z.string(),
  sid: z.string().min(1).max(255),
  credentials: oauthCredentialsSchema,
  createdAt: z.number(),
  expiresAt: z.number(),
  verifiedAt: z.number(),
})
interface StoreOptions {
  databaseUrl: string
  seal(value: Record<string, unknown>, expiresAt: Date): Promise<string>
  open(value: string): Promise<unknown>
}
export function createAuthStore(options: StoreOptions) {
  // Two bounded pools: lock waiters must never starve credential checkpoints.
  // Transaction-scoped advisory locks also work with transaction-mode poolers.
  const data = postgres(options.databaseUrl, {
    max: 5,
    prepare: false,
    connect_timeout: 10,
  })
  const locks = postgres(options.databaseUrl, {
    max: 5,
    prepare: false,
    connect_timeout: 10,
  })
  const selectUser = (id: string, sql = data) => sql<AuthAccount[]>`
    SELECT id, external_user_id AS "externalUserId", name, email, username, image,
      role, status, banned_at AS "bannedAt", deleted_at AS "deletedAt"
    FROM "user" WHERE id = ${id} LIMIT 1`
  const allowed = (user: AuthAccount) =>
    user.status === "active" && !user.bannedAt && !user.deletedAt
  const identity: IdentityAdapter<AuthAccount> = {
    allowed,
    async read(user) {
      return (await selectUser(user.id))[0] ?? null
    },
    async synchronize(profile: AuthIdentity, previous) {
      if (
        !profile.email ||
        (previous && previous.externalUserId !== profile.subject)
      )
        throw new AuthError("rejected")
      const username = profile.username ?? null
      if (username && !/^[a-z0-9._-]{1,64}$/i.test(username))
        throw new AuthError("rejected")
      const [user] = await data<AuthAccount[]>`
        INSERT INTO "user" (external_user_id, email, name, username, image, last_seen_at, synced_at, updated_at)
        VALUES (${profile.subject}, ${profile.email}, ${profile.name || profile.email},
          ${username?.toLowerCase() ?? null}, ${profile.image ?? null}, NOW(), NOW(), NOW())
        ON CONFLICT (external_user_id) DO UPDATE SET
          email = EXCLUDED.email, name = EXCLUDED.name, username = EXCLUDED.username,
          image = EXCLUDED.image, last_seen_at = NOW(), synced_at = NOW(), updated_at = NOW()
        RETURNING id, external_user_id AS "externalUserId", name, email, username, image,
          role, status, banned_at AS "bannedAt", deleted_at AS "deletedAt"`
      if (!user) throw new AuthError("rejected")
      return user
    },
  }
  const fence = <T>(
    operation: (sql: ReturnType<typeof postgres>) => Promise<T>
  ) =>
    data.begin(async (transaction) => {
      await transaction`SELECT pg_advisory_xact_lock(hashtextextended('gorth:auth:revocation', 0))`
      return operation(transaction as unknown as ReturnType<typeof postgres>)
    }) as Promise<T>
  async function revoked(
    sql: ReturnType<typeof postgres>,
    input: Parameters<LogoutStorage["isRevoked"]>[0]
  ) {
    const rows =
      await sql`SELECT jti FROM "revocation" WHERE expires_at > ${new Date(input.now)}
      AND ((sid IS NOT NULL AND sid = ${input.sid ?? null}
        AND (subject IS NULL OR subject = ${input.subject}))
        OR (sid IS NULL AND subject = ${input.subject}
          AND ${new Date(input.issuedAt)} <= created_at + INTERVAL '1 second'))
      LIMIT 1`
    return rows.length > 0
  }
  const revocation: LogoutStorage = {
    isRevoked: (input) => revoked(data, input),
    apply: (logout) =>
      fence(async (sql) => {
        await sql`DELETE FROM "revocation" WHERE expires_at <= NOW()`
        const receipt =
          await sql`INSERT INTO "revocation" (jti, sid, subject, expires_at, created_at)
        VALUES (${logout.jti}, ${logout.sid ?? null}, ${logout.subject ?? null},
          ${new Date(logout.revokeUntil)}, ${new Date(logout.issuedAt)})
        ON CONFLICT (jti) DO NOTHING RETURNING jti`
        if (!receipt.length) return false
        await sql`DELETE FROM "session" AS s USING "user" AS u
        WHERE s.user_id = u.id
          AND (${logout.sid ?? null}::text IS NULL OR s.sso_session_id = ${logout.sid ?? null})
          AND (${logout.subject ?? null}::text IS NULL OR u.external_user_id = ${logout.subject ?? null})
          AND (${logout.sid ?? null}::text IS NOT NULL
            OR s.created_at < ${new Date(logout.issuedAt + 1000)})`
        return true
      }),
  }
  async function decode(
    key: string,
    sql = data,
    current = false
  ): Promise<StoredSession<AuthAccount> | null> {
    const [row] = await sql<
      (AuthAccount & {
        credentials: string | null
        expires_at: Date
        created_at: Date
        sso_session_id: string
      })[]
    >`
      SELECT s.credentials, s.expires_at, s.created_at, s.sso_session_id, u.id,
        u.external_user_id AS "externalUserId", u.name, u.email, u.username,
        u.image, u.role, u.status, u.banned_at AS "bannedAt", u.deleted_at AS "deletedAt"
      FROM "session" AS s JOIN "user" AS u ON u.id = s.user_id
      WHERE s.token_hash = ${key}
        AND (NOT ${current} OR (
          s.expires_at > NOW() AND u.status = 'active'
          AND u.banned_at IS NULL AND u.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM "revocation" AS r WHERE r.expires_at > NOW()
              AND ((r.sid IS NOT NULL AND r.sid = s.sso_session_id
                AND (r.subject IS NULL OR r.subject = u.external_user_id))
                OR (r.sid IS NULL AND r.subject = u.external_user_id
                  AND s.created_at <= r.created_at + INTERVAL '1 second'))
          )
        )) LIMIT 1`
    if (!row?.credentials || row.expires_at.getTime() <= Date.now()) return null
    let parsed: z.infer<typeof recordSchema>
    try {
      parsed = recordSchema.parse(await options.open(row.credentials))
    } catch {
      return null
    }
    // A database outage is unavailable, not an invalid session. Do not clear
    // the browser cookie because a profile query temporarily failed.
    // One authoritative snapshot avoids a second cloud DB round trip.
    const user: AuthAccount = {
      id: row.id,
      externalUserId: row.externalUserId,
      name: row.name,
      email: row.email,
      username: row.username,
      image: row.image,
      role: row.role,
      status: row.status,
      bannedAt: row.bannedAt,
      deletedAt: row.deletedAt,
    }
    if (
      parsed.key !== key ||
      parsed.subject !== user.externalUserId ||
      parsed.expiresAt !== row.expires_at.getTime() ||
      (current &&
        (parsed.sid !== row.sso_session_id ||
          parsed.createdAt !== row.created_at.getTime()))
    )
      return null
    return { ...parsed, user }
  }
  async function readCurrentCredentials(
    key: string,
    binding: string,
    policy: Readonly<AuthPolicy>
  ): Promise<SessionCredentials<AuthAccount> | null | undefined> {
    // A single SQL statement is the authorization snapshot: no credential cache,
    // no network call and no write/refresh lock. Logout and bans affect the next
    // statement immediately. Any work that could rotate or mutate goes to core.
    const session = await decode(key, data, true)
    if (!session) return null
    if (
      session.binding !== binding ||
      session.subject !== session.credentials.subject ||
      !allowed(session.user)
    )
      return null
    const now = Date.now()
    if (session.expiresAt <= now) return null
    const freshness = createAuthFreshnessPolicy(
      policy,
      () => now
    )({
      verifiedAt: session.verifiedAt,
      accessExpiresAt: session.credentials.accessExpiresAt,
    })
    if (freshness.verifyIdentity || freshness.refresh) return undefined
    // Hono-internal credentials only; public endpoints project safe fields.
    return formatSessionCredentials(session)
  }
  const storage: SessionStorage<AuthAccount> = {
    withLock: (key, operation) =>
      locks.begin(async (sql) => {
        await sql`SET LOCAL lock_timeout = '10s'`
        await sql`SELECT pg_advisory_xact_lock(hashtextextended(${"gorth:auth:refresh:" + key}, 0))`
        // operation uses the other pool, so each checkpoint commits immediately.
        return operation()
      }) as ReturnType<typeof operation>,
    read: (key) => decode(key),
    insert: (session) =>
      fence(async (sql) => {
        if (
          await revoked(sql, {
            subject: session.subject,
            sid: session.sid,
            issuedAt: session.createdAt,
            now: Date.now(),
          })
        )
          return false
        const encrypted = await options.seal(
          { ...session },
          new Date(session.expiresAt)
        )
        const rows = await sql`INSERT INTO "session"
        (token_hash, credentials, sso_session_id, user_id, expires_at, created_at)
        VALUES (${session.key}, ${encrypted}, ${session.sid ?? null}, ${session.user.id},
          ${new Date(session.expiresAt)}, ${new Date(session.createdAt)})
        ON CONFLICT (token_hash) DO NOTHING RETURNING id`
        return rows.length === 1
      }),
    replace: (key, revision, next) =>
      fence(async (sql) => {
        const current = await decode(key, sql)
        if (
          !current ||
          current.revision !== revision ||
          (await revoked(sql, {
            subject: next.subject,
            sid: next.sid,
            issuedAt: next.createdAt,
            now: Date.now(),
          }))
        )
          return false
        const encrypted = await options.seal(
          { ...next },
          new Date(next.expiresAt)
        )
        const rows = await sql`UPDATE "session" SET credentials = ${encrypted},
        expires_at = ${new Date(next.expiresAt)}
        WHERE token_hash = ${key} RETURNING id`
        return rows.length === 1
      }),
    remove: (key, revision) =>
      fence(async (sql) => {
        const current = await decode(key, sql)
        if (revision && current?.revision !== revision) return null
        await sql`DELETE FROM "session" WHERE token_hash = ${key}`
        return current
      }),
  }
  const login: LoginStorage = {
    async reserve(stateHash, expiresAt) {
      await data`DELETE FROM "verification" WHERE expires_at <= NOW()`
      const rows =
        await data`INSERT INTO "verification" (state_hash, expires_at)
        VALUES (${stateHash}, ${new Date(expiresAt)})
        ON CONFLICT (state_hash) DO NOTHING RETURNING state_hash`
      return rows.length === 1
    },
    async consume(stateHash, now) {
      const rows = await data`DELETE FROM "verification"
        WHERE state_hash = ${stateHash} AND expires_at > ${new Date(now)}
        RETURNING state_hash`
      return rows.length === 1
    },
  }
  const proof: ProofStorage = {
    async consume(key, expiresAt) {
      // Unique-key insertion still arbitrates replay across processes. Cleanup
      // and insertion are one atomic statement, not four cloud round trips.
      const rows = await data`WITH expired AS (
          DELETE FROM "proof" WHERE key IN (
            SELECT key FROM "proof" WHERE expires_at <= NOW() LIMIT 256
          ) RETURNING key
        ) INSERT INTO "proof" (key, expires_at)
        VALUES (${key}, ${new Date(expiresAt)})
        ON CONFLICT (key) DO NOTHING RETURNING key`
      return rows.length === 1
    },
  }
  return {
    identity,
    storage,
    login,
    revocation,
    proof,
    readCurrentCredentials,
    close: () =>
      Promise.all([data.end({ timeout: 5 }), locks.end({ timeout: 5 })]),
  }
}
