import { beforeEach, expect, it, vi } from "vitest"
import type {
  StoredSession,
  VerifiedLogin,
} from "@gorth/structure/modules/auth/server"
import type { AuthAccount } from "@/lib/auth/store"

const fixture = vi.hoisted(() => ({
  records: new Map<string, StoredSession<AuthAccount>>(),
  removalFails: false,
  revocationFails: false,
  centralRevocation: vi.fn(),
  transport: vi.fn(),
}))

vi.mock("@/utils/environment", () => ({
  nodeEnv: "production",
  appUrl: "https://website.example.test",
  ssoClientUrl: "https://sso.example.test",
  ssoServerUrl: "https://sso-api.example.test",
  ssoOAuthClientId: "fixture-website",
  authSecret: "fixture-only-auth-secret-at-least-32-bytes",
  databaseUrl: "postgres://fixture.invalid/test",
  sessionMaxAgeSeconds: "2592000",
}))
vi.mock("@/lib/auth/store", () => ({
  createAuthStore: () => ({
    storage: {
      withLock: async (_key: string, operation: () => Promise<unknown>) =>
        operation(),
      read: async (key: string) => fixture.records.get(key) ?? null,
      remove: async (key: string) => {
        if (fixture.removalFails)
          throw new Error("fixture-database-unavailable")
        const previous = fixture.records.get(key) ?? null
        fixture.records.delete(key)
        return previous
      },
      insert: async (record: StoredSession<AuthAccount>) => {
        if (fixture.records.has(record.key)) return false
        fixture.records.set(record.key, record)
        return true
      },
    },
    identity: {
      allowed: () => true,
      synchronize: async () => ({
        id: "local-user",
        externalUserId: "sso-sub",
        name: "Test",
        email: "test@example.test",
        username: null,
        image: null,
        role: "user",
        status: "active",
        bannedAt: null,
        deletedAt: null,
      }),
    },
    revocation: {
      apply: fixture.centralRevocation,
      isRevoked: async () => false,
    },
    login: {},
  }),
}))
vi.mock("@/utils/fetcher", () => ({ fetcher: fixture.transport }))
import { getAuthRuntime } from "@/lib/auth/runtime"
import { fingerprintAuthValue } from "@gorth/structure/modules/auth/server"

function login(grant: string): VerifiedLogin {
  return {
    identity: { subject: "sso-sub", email: "test@example.test", name: "Test" },
    sid: "unchanged-central-sso-session",
    returnTo: "/",
    credentials: {
      subject: "sso-sub",
      nonce: "n".repeat(43),
      accessToken: "fixture-access-" + grant,
      refreshToken: "fixture-refresh-" + grant,
      accessExpiresAt: Date.now() + 600_000,
    },
  }
}
beforeEach(() => {
  fixture.records.clear()
  fixture.removalFails = false
  fixture.revocationFails = false
  fixture.centralRevocation.mockClear()
  fixture.transport.mockReset()
  fixture.transport.mockImplementation(async () => {
    if (fixture.revocationFails) throw new Error("fixture-sso-unavailable")
    return { status: 200, data: {} }
  })
})

it("deletes the app handle before grant revocation without revoking the central SID", async () => {
  const auth = getAuthRuntime()
  const first = await auth.sessions.create(login("first"))
  const another = await auth.sessions.create(login("another"))
  const key = await fingerprintAuthValue(first.handle)
  fixture.transport.mockImplementation(async () => {
    expect(fixture.records.has(key)).toBe(false)
    return { status: 200, data: {} }
  })
  expect(await auth.signOut(first.handle)).toEqual({ remoteRevoked: true })
  expect(await auth.sessions.get(first.handle)).toBeNull()
  expect(fixture.records.has(await fingerprintAuthValue(another.handle))).toBe(
    true
  )
  expect(fixture.centralRevocation).not.toHaveBeenCalled()
  expect(fixture.transport).toHaveBeenCalledTimes(2)
  for (const [request] of fixture.transport.mock.calls) {
    expect(request.url).toBe("https://sso-api.example.test/auth/oauth2/revoke")
    expect(request.body.get("client_id")).toBe("fixture-website")
    expect(request.headers.Cookie).toBeUndefined()
  }
  // A fresh login from the still-live SSO session must not be blocked by logout.
  const renewed = await auth.sessions.create(login("renewed"))
  expect(fixture.records.has(await fingerprintAuthValue(renewed.handle))).toBe(
    true
  )
})

it("keeps the old app handle deleted during an SSO grant-revocation outage", async () => {
  const auth = getAuthRuntime()
  const session = await auth.sessions.create(login("outage"))
  fixture.revocationFails = true
  expect(await auth.signOut(session.handle)).toEqual({ remoteRevoked: false })
  expect(await auth.sessions.get(session.handle)).toBeNull()
  expect(fixture.centralRevocation).not.toHaveBeenCalled()
})

it("does not revoke a grant or claim success when durable local deletion fails", async () => {
  const auth = getAuthRuntime()
  const session = await auth.sessions.create(login("db-outage"))
  fixture.removalFails = true
  await expect(auth.signOut(session.handle)).rejects.toThrow(
    "fixture-database-unavailable"
  )
  expect(fixture.records.has(await fingerprintAuthValue(session.handle))).toBe(
    true
  )
  expect(fixture.transport).not.toHaveBeenCalled()
})
