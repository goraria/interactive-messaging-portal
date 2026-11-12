import { beforeEach, expect, it, vi } from "vitest"
const fixture = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock("@gorth/structure/cores/postgres", () => ({
  default: () => fixture.query,
}))
import { createAuthStore } from "@/lib/auth/store"
import { createAuthPolicy } from "@gorth/structure/modules/auth/server"

const expiresAt = Date.now() + 60_000
const record = {
  key: "fixture-key",
  revision: "fixture-revision",
  binding: "fixture-binding",
  subject: "sso-subject",
  sid: "central-session",
  createdAt: Date.now(),
  expiresAt,
  verifiedAt: Date.now(),
  credentials: {
    subject: "sso-subject",
    nonce: "n".repeat(43),
    accessToken: "fixture-access",
    accessExpiresAt: expiresAt,
  },
}
const user = {
  id: "local-user-id",
  externalUserId: "sso-subject",
  status: "active",
  role: "user",
  bannedAt: null,
  deletedAt: null,
}
function store(payload: unknown = record) {
  return createAuthStore({
    databaseUrl: "postgres://fixture.invalid/test",
    seal: async () => "encrypted-fixture",
    open: async () => payload,
  })
}
beforeEach(() => {
  fixture.query.mockReset()
  fixture.query.mockResolvedValueOnce([
    {
      credentials: "encrypted-fixture",
      ...user,
      expires_at: new Date(expiresAt),
      created_at: new Date(record.createdAt),
      sso_session_id: record.sid,
    },
  ])
})

const policy = createAuthPolicy()
it("authorizes a recent session in one current DB snapshot without acquiring a lock", async () => {
  const result = await store().readCurrentCredentials(
    record.key,
    record.binding,
    policy
  )
  expect(result?.credentials.accessToken).toBe("fixture-access")
  expect(result?.user.role).toBe("user")
  expect(fixture.query).toHaveBeenCalledTimes(1)
  const [sql, ...parameters] = fixture.query.mock.calls[0]!
  expect(sql.join("")).toContain("NOT EXISTS")
  expect(sql.join("")).toContain('FROM "revocation"')
  expect(sql.join("")).toContain("u.banned_at IS NULL")
  expect(parameters).toContain(true)
})

it.each([
  { verifiedAt: Date.now() - 120_001 },
  { verifiedAt: Date.now() + 120_000 },
  {
    credentials: {
      ...record.credentials,
      accessExpiresAt: Date.now() + 29_000,
    },
  },
])(
  "defers stale identity or expiring credentials to the locked shared service",
  async (change) => {
    expect(
      await store({ ...record, ...change }).readCurrentCredentials(
        record.key,
        record.binding,
        policy
      )
    ).toBeUndefined()
  }
)

it("uses app-supplied freshness limits rather than a local hard-coded TTL", async () => {
  const stricterPolicy = createAuthPolicy({ identityMaxAgeMs: 1_000 })
  expect(
    await store({
      ...record,
      verifiedAt: Date.now() - 2_000,
    }).readCurrentCredentials(record.key, record.binding, stricterPolicy)
  ).toBeUndefined()
})

it.each([
  { binding: "another-app-binding" },
  { credentials: { ...record.credentials, subject: "another-subject" } },
  { sid: "another-central-session" },
  { createdAt: record.createdAt - 1000 },
])(
  "rejects credentials that do not match the trusted current snapshot",
  async (change) => {
    expect(
      await store({ ...record, ...change }).readCurrentCredentials(
        record.key,
        record.binding,
        policy
      )
    ).toBeNull()
  }
)

it("does not reuse an earlier authorization after DB deletion or revocation", async () => {
  const auth = store()
  expect(
    await auth.readCurrentCredentials(record.key, record.binding, policy)
  ).not.toBeNull()
  fixture.query.mockResolvedValueOnce([])
  expect(
    await auth.readCurrentCredentials(record.key, record.binding, policy)
  ).toBeNull()
  expect(fixture.query).toHaveBeenCalledTimes(2)
})

it("rejects a newly banned user even with recent credentials", async () => {
  fixture.query.mockReset()
  fixture.query.mockResolvedValue([
    {
      ...user,
      bannedAt: new Date(),
      credentials: "encrypted-fixture",
      expires_at: new Date(expiresAt),
      created_at: new Date(record.createdAt),
      sso_session_id: record.sid,
    },
  ])
  expect(
    await store().readCurrentCredentials(record.key, record.binding, policy)
  ).toBeNull()
})

it("persists replay protection and bounded cleanup in one DB statement", async () => {
  fixture.query.mockReset()
  fixture.query
    .mockResolvedValueOnce([{ key: "proof" }])
    .mockResolvedValueOnce([])
  const auth = store()
  expect(await auth.proof.consume("proof", expiresAt)).toBe(true)
  expect(await auth.proof.consume("proof", expiresAt)).toBe(false)
  expect(fixture.query).toHaveBeenCalledTimes(2)
  const sql = fixture.query.mock.calls[0]![0].join("")
  expect(sql).toContain("LIMIT 256")
  expect(sql).toContain("ON CONFLICT (key) DO NOTHING")
})
