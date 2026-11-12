import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  generateKeyPair,
  exportJWK,
  createLocalJWKSet,
  SignJWT,
} from "@gorth/structure/cores/jose"
import {
  AuthError,
  createOAuthProvider,
  createSessionService,
  createLogoutVerifier,
  createResourceAuth,
  fingerprintAuthValue,
  type StoredSession,
  type VerifiedLogout,
  type AuthIdentity,
  type OAuthProvider,
} from "@gorth/structure/modules/auth/server"

interface User {
  id: string
  externalUserId: string
  role: string
  status: string
  name: string
  email: string
}
const subject = "sso-subject-not-local-uuid"
const issuer = "https://sso.example.test/auth",
  clientId = "gorth-interactive-messaging-portal"
const callback = "https://chat.example.test/auth/exchange",
  resourceUrl = "https://chat-api.example.test"
function memoryStore() {
  const records = new Map<string, StoredSession<User>>()
  const markers: VerifiedLogout[] = []
  const proofs = new Map<string, number>()
  const receipts = new Map<string, number>()
  let local: User = {
    id: "local-uuid",
    externalUserId: subject,
    role: "local-admin",
    status: "active",
    name: "Local",
    email: "user@example.test",
  }
  const chains = new Map<string, Promise<void>>()
  const revoked = (input: {
    subject: string
    sid?: string
    issuedAt: number
    now: number
  }) =>
    markers.some(
      (marker) =>
        marker.revokeUntil > input.now &&
        (marker.sid
          ? marker.sid === input.sid &&
            (!marker.subject || marker.subject === input.subject)
          : marker.subject === input.subject &&
            input.issuedAt < marker.issuedAt + 1000)
    )
  const revocation = {
    async isRevoked(input: Parameters<typeof revoked>[0]) {
      return revoked(input)
    },
    async apply(marker: VerifiedLogout) {
      if (markers.some((previous) => previous.jti === marker.jti)) return false
      markers.push(marker)
      for (const [key, row] of records)
        if (
          revoked({
            subject: row.subject,
            sid: row.sid,
            issuedAt: row.createdAt,
            now: Date.now(),
          })
        )
          records.delete(key)
      return true
    },
  }
  const storage = {
    async withLock<T>(key: string, operation: () => Promise<T>) {
      const previous = chains.get(key) ?? Promise.resolve()
      let release!: () => void
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      chains.set(
        key,
        previous.then(() => held)
      )
      await previous
      try {
        return await operation()
      } finally {
        release()
      }
    },
    async read(key: string) {
      return records.get(key) ?? null
    },
    async insert(record: StoredSession<User>) {
      if (
        records.has(record.key) ||
        revoked({
          subject: record.subject,
          sid: record.sid,
          issuedAt: record.createdAt,
          now: Date.now(),
        })
      )
        return false
      records.set(record.key, record)
      return true
    },
    async replace(key: string, revision: string, next: StoredSession<User>) {
      if (
        records.get(key)?.revision !== revision ||
        revoked({
          subject: next.subject,
          sid: next.sid,
          issuedAt: next.createdAt,
          now: Date.now(),
        })
      )
        return false
      records.set(key, next)
      return true
    },
    async remove(key: string, revision?: string) {
      const record = records.get(key)
      if (!record || (revision && record.revision !== revision)) return null
      records.delete(key)
      return record
    },
  }
  const identity = {
    async synchronize(profile: AuthIdentity) {
      local = { ...local, name: profile.name ?? local.name }
      return local
    },
    async read() {
      return local
    },
    allowed(user: User) {
      return user.status === "active"
    },
  }
  const proof = {
    async consume(key: string, expiresAt: number) {
      if ((proofs.get(key) ?? 0) > Date.now()) return false
      proofs.set(key, expiresAt)
      return true
    },
  }
  const login = {
    async reserve(key: string, expiresAt: number) {
      if (receipts.has(key)) return false
      receipts.set(key, expiresAt)
      return true
    },
    async consume(key: string, now: number) {
      const expires = receipts.get(key)
      receipts.delete(key)
      return typeof expires === "number" && expires > now
    },
  }
  return {
    records,
    markers,
    storage,
    identity,
    revocation,
    proof,
    login,
    suspend() {
      local = { ...local, status: "suspended" }
    },
  }
}
beforeEach(() => {
  vi.restoreAllMocks()
})
describe("independent API authentication", () => {
  describe("protected API access tokens", () => {
    it("checks resource audience, scopes, SSO sub, revocation and online fallback without cookies", async () => {
      const store = memoryStore(),
        keys = await generateKeyPair("RS256")
      const jwk = {
        ...(await exportJWK(keys.publicKey)),
        kid: "api-fixture",
        alg: "RS256",
      }
      vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
        Response.json({ keys: [jwk] })
      )
      const online = vi.fn(async () => {})
      const resource = createResourceAuth({
        verification: {
          jwksUrl: issuer + "/jwks",
          verifyOptions: { issuer, audience: resourceUrl },
          requiredScopes: ["chat:read"],
        },
        proof: store.proof,
        revocation: store.revocation,
        onlineVerification: "always",
        verifyActive: online,
      })
      const token = (audience: string, scope = "chat:read", sid = "api-sid") =>
        new SignJWT({ sid, scope })
          .setProtectedHeader({
            alg: "RS256",
            kid: "api-fixture",
            typ: "at+jwt",
          })
          .setIssuer(issuer)
          .setAudience(audience)
          .setSubject(subject)
          .setIssuedAt()
          .setExpirationTime("5m")
          .sign(keys.privateKey)
      const input = async (audience: string, scope = "chat:read") => ({
        authorizationHeader: "Bearer " + (await token(audience, scope)),
        method: "GET",
        url: resourceUrl + "/chat/message",
      })
      const claims = await resource.verify(await input(resourceUrl))
      expect(claims.sub).toBe(subject)
      expect(online).toHaveBeenCalledOnce()
      // ID tokens carry the OAuth client audience, never the API resource audience.
      await expect(
        resource.verify(await input(clientId))
      ).rejects.toMatchObject({ code: "rejected" })
      await expect(
        resource.verify(await input(resourceUrl, "chat:write"))
      ).rejects.toMatchObject({ code: "forbidden" })
      await store.revocation.apply({
        jti: "api-logout",
        subject,
        sid: "api-sid",
        issuedAt: Date.now(),
        receiptExpiresAt: Date.now() + 120_000,
        revokeUntil: Date.now() + 86400_000,
      })
      await expect(
        resource.verify(await input(resourceUrl))
      ).rejects.toMatchObject({ code: "rejected" })
      expect(online).toHaveBeenCalledOnce()
    })
  })
})
describe("app sessions, refresh, local policy and logout", () => {
  it("reuses a new session identity for 120 seconds and revalidates once for concurrent reads", async () => {
    const store = memoryStore()
    let now = Date.now()
    const identity = vi.fn(async () => ({ subject, name: "SSO name" }))
    const provider: OAuthProvider = {
      binding: "fixture",
      identity,
      refresh: async (credentials) => credentials,
      revoke: async () => {},
    }
    const sessions = createSessionService({
      provider,
      storage: store.storage,
      identity: store.identity,
      revocation: store.revocation,
      now: () => now,
      policy: { identityMaxAgeMs: 120_000 },
    })
    const created = await sessions.create({
      identity: { subject, name: "SSO name" },
      sid: "central-session",
      returnTo: "/chat",
      credentials: {
        subject,
        nonce: "n".repeat(43),
        accessToken: "fixture-access",
        accessExpiresAt: now + 3_600_000,
      },
    })
    await sessions.get(created.handle)
    now += 119_999
    await sessions.get(created.handle)
    expect(identity).not.toHaveBeenCalled()
    now += 1
    await Promise.all(
      Array.from({ length: 5 }, () => sessions.get(created.handle))
    )
    expect(identity).toHaveBeenCalledTimes(1)
    await sessions.get(created.handle, { fresh: true })
    expect(identity).toHaveBeenCalledTimes(2)
    store.suspend()
    expect(await sessions.get(created.handle)).toBeNull()
  })
  it("checkpoints rotated credentials before UserInfo outage and coordinates concurrent reads", async () => {
    const store = memoryStore()
    let unavailable = false
    let refreshes = 0
    const provider: OAuthProvider = {
      binding: "fixture",
      async identity() {
        if (unavailable) throw new AuthError("unavailable")
        return { subject, name: "SSO name" }
      },
      async refresh(old) {
        refreshes++
        return {
          ...old,
          accessToken: "rotated-access",
          refreshToken: "rotated-refresh",
          accessExpiresAt: Date.now() + 600_000,
        }
      },
      async revoke() {},
    }
    const sessions = createSessionService({
      provider,
      ...store,
      storage: store.storage,
    })
    const created = await sessions.create({
      identity: { subject, email: "user@example.test" },
      credentials: {
        subject,
        nonce: "a".repeat(43),
        accessToken: "old-access",
        refreshToken: "old-refresh",
        accessExpiresAt: Date.now() + 10_000,
      },
      sid: "central-sid",
      returnTo: "/",
    })
    const key = await fingerprintAuthValue(created.handle)
    unavailable = true
    await expect(
      sessions.get(created.handle, { fresh: true })
    ).rejects.toMatchObject({ code: "unavailable" })
    expect(store.records.get(key)?.credentials.refreshToken).toBe(
      "rotated-refresh"
    )
    unavailable = false
    const results = await Promise.all([
      sessions.get(created.handle, { fresh: true }),
      sessions.get(created.handle, { fresh: true }),
    ])
    expect(refreshes).toBe(1)
    expect(results.every((result) => result?.user.role === "local-admin")).toBe(
      true
    )
    expect(results[0]?.user.id).toBe("local-uuid")
    expect(store.records.get(key)?.subject).toBe(subject)
    store.suspend()
    expect(await sessions.get(created.handle)).toBeNull()
  })
  it("does not resurrect an app session if a logout event arrives during identity refresh", async () => {
    const store = memoryStore()
    let entered!: () => void, release!: () => void
    const enteredPromise = new Promise<void>((resolve) => {
      entered = resolve
    })
    const pause = new Promise<void>((resolve) => {
      release = resolve
    })
    const provider: OAuthProvider = {
      binding: "fixture",
      async refresh(old) {
        return old
      },
      async revoke() {},
      async identity() {
        entered()
        await pause
        return { subject }
      },
    }
    const sessions = createSessionService({
      provider,
      ...store,
      storage: store.storage,
    })
    const created = await sessions.create({
      identity: { subject, email: "user@example.test" },
      credentials: {
        subject,
        nonce: "a".repeat(43),
        accessToken: "access",
        refreshToken: "refresh",
        accessExpiresAt: Date.now() + 600_000,
      },
      sid: "central-sid",
      returnTo: "/",
    })
    const pending = sessions.get(created.handle, { fresh: true })
    await enteredPromise
    await store.revocation.apply({
      jti: "logout-race",
      sid: "central-sid",
      subject,
      issuedAt: Date.now(),
      receiptExpiresAt: Date.now() + 120_000,
      revokeUntil: Date.now() + 86400_000,
    })
    release()
    expect(await pending).toBeNull()
    expect(await sessions.get(created.handle)).toBeNull()
  })
  it("rejects wrong issuer/audience/nonce, consumes callback once, retains local role and handles signed logout", async () => {
    const store = memoryStore(),
      keys = await generateKeyPair("RS256"),
      jwk = {
        ...(await exportJWK(keys.publicKey)),
        kid: "fixture",
        alg: "RS256",
      }
    const getVerificationKey = async () => createLocalJWKSet({ keys: [jwk] })
    let nonce = ""
    const provider = createOAuthProvider({
      config: {
        issuer,
        clientId,
        redirectUri: callback,
        postLogoutRedirectUri: "https://chat.example.test",
        endpointOrigins: ["https://sso.example.test"],
        scopes: ["openid", "profile", "email", "offline_access", "chat:read"],
        resources: [resourceUrl, "https://resource.example.test"],
        endpoints: {
          authorization: issuer + "/authorize",
          token: issuer + "/token",
          userinfo: issuer + "/userinfo",
          revocation: issuer + "/revoke",
          endSession: issuer + "/end-session",
        },
      },
      getVerificationKey,
      loginStorage: store.login,
      transport: {
        async request(url, options) {
          if (url.endsWith("/token")) {
            expect(options.body?.getAll("resource")).toEqual([
              resourceUrl,
              "https://resource.example.test",
            ])
            const id = await new SignJWT({ nonce, sid: "central-sid" })
              .setProtectedHeader({ alg: "RS256", kid: "fixture" })
              .setIssuer(issuer)
              .setAudience(clientId)
              .setSubject(subject)
              .setIssuedAt()
              .setExpirationTime("5m")
              .sign(keys.privateKey)
            return {
              status: 200,
              data: {
                access_token: "access",
                refresh_token: "refresh",
                token_type: "Bearer",
                expires_in: 600,
                id_token: id,
              },
            }
          }
          return {
            status: 200,
            data: {
              sub: subject,
              name: "SSO name",
              email: "user@example.test",
              role: "super-admin",
            },
          }
        },
      },
    })
    const start = await provider.startLogin("/chat")
    nonce = start.transaction.nonce
    const url = new URL(callback)
    url.search = new URLSearchParams({
      code: "fixture-code",
      state: start.transaction.state,
      iss: issuer,
    }).toString()
    const verified = await provider.finishLogin(url.href, start.transaction)
    expect(verified.identity).not.toHaveProperty("role")
    await expect(
      provider.finishLogin(url.href, start.transaction)
    ).rejects.toMatchObject({ code: "rejected" })
    const sessions = createSessionService({
      provider,
      ...store,
      storage: store.storage,
    })
    const created = await sessions.create(verified)
    expect(created.session.user.role).toBe("local-admin")
    const verifier = createLogoutVerifier({
      issuer,
      clientId,
      getVerificationKey,
      storage: store.revocation,
    })
    const logoutToken = await new SignJWT({
      sid: "central-sid",
      events: { "http://schemas.openid.net/event/backchannel-logout": {} },
    })
      .setProtectedHeader({ alg: "RS256", kid: "fixture", typ: "logout+jwt" })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime("2m")
      .setJti("signed-logout")
      .sign(keys.privateKey)
    expect(await verifier.handle(logoutToken)).toEqual({ applied: true })
    expect(await verifier.handle(logoutToken)).toEqual({ applied: false })
    expect(await sessions.get(created.handle)).toBeNull()
    expect(store.markers[0]!.revokeUntil).toBeGreaterThan(
      Date.now() + 6 * 86400_000
    )
  })
})
