import { beforeEach, expect, it, vi } from "vitest"
const fixture = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock("@gorth/structure/cores/postgres", () => ({
  default: () => fixture.query,
}))
import { createAuthStore } from "@/lib/auth/store"

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

it("propagates a joined session/profile database outage instead of treating the session as invalid", async () => {
  const unavailable = new Error("fixture-database-unavailable")
  fixture.query.mockReset()
  fixture.query.mockRejectedValueOnce(unavailable)
  await expect(store().storage.read(record.key)).rejects.toBe(unavailable)
})

it("rejects a corrupt stored payload without another database round trip", async () => {
  await expect(store({}).storage.read(record.key)).resolves.toBeNull()
  expect(fixture.query).toHaveBeenCalledTimes(1)
})

it("rejects a stored subject that does not match the current local account", async () => {
  fixture.query.mockReset()
  fixture.query.mockResolvedValueOnce([
    {
      ...user,
      externalUserId: "different-subject",
      credentials: "encrypted-fixture",
      expires_at: new Date(expiresAt),
    },
  ])
  await expect(store().storage.read(record.key)).resolves.toBeNull()
})

it("reads the session and current local user in one joined query", async () => {
  const result = await store().storage.read(record.key)
  expect(result?.user).toEqual(user)
  expect(result?.user).not.toHaveProperty("credentials")
  expect(fixture.query).toHaveBeenCalledTimes(1)
  expect(fixture.query.mock.calls[0]![0].join("")).toContain('JOIN "user"')
})
