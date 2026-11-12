import { beforeEach, expect, it, vi } from "vitest"
import { Hono } from "hono"
import { AuthError } from "@gorth-io/structure/modules/auth/server"

const fixture = vi.hoisted(() => ({
  credentials: vi.fn(),
  verify: vi.fn(),
  profile: vi.fn(),
  local: vi.fn(),
}))
vi.mock("@/utils/environment", () => ({
  oauthCookiePrefix: "gorth",
  appUrl: "https://chat.example.test",
  oauthAudience: "https://chat-api.example.test",
  authUrl: "https://sso.example.test",
  oauthClientId: "chat",
  sessionSecret: "fixture-only-session-key-at-least-32-bytes",
  oauthNotifyAudience: "",
  oauthResourceAudience: "",
  oauthDiscoveryAudience: "",
  oauthPaymentAudience: "",
  oauthBillingAudience: "",
  oauthMediaAudience: "",
  oauthInsightAudience: "",
  isProduction: true,
  sessionAppCookie: "gorth.session_token",
  accessTokenCookie: "gorth.access_token",
  refreshTokenCookie: "gorth.refresh_token",
  oauthReadScope: "chat:read",
  oauthWriteScope: "chat:write",
}))
vi.mock("@/services/session", () => ({
  readAppIdentity: fixture.credentials,
  readAppCredentials: fixture.credentials,
}))
vi.mock("@/services/sso", () => ({
  verifySsoAccessTokenRequest: fixture.verify,
  getVerifiedSsoUserInfo: fixture.profile,
}))
vi.mock("@/services/users", () => ({ findUserByExternalId: fixture.local }))
import type { ApiEnv } from "@/utils/interface"
import { requireAuth } from "@/middlewares/auth"

const routes = new Hono<ApiEnv>()
routes.get("/private", requireAuth(), (context) =>
  context.json(context.get("auth"))
)
routes.post("/private", requireAuth(), (context) =>
  context.json(context.get("auth"))
)
const app = new Hono().route("/", routes)
const handle = "a".repeat(43)
const cookie =
  "gorth.session_token=" + handle + "; gorth.access_token=untrusted-cookie"
const account = () => ({
  syncedAt: new Date(),
  id: "local-uuid",
  externalUserId: "sso-sub",
  name: "User",
  email: "user@example.test",
  username: null,
  image: null,
  status: "active",
  role: "local-admin",
  bannedAt: null,
  deletedAt: null,
})
const session = () => ({
  subject: "sso-sub",
  user: account(),
  expiresAt: Date.now() + 600_000,
  credentials: {
    accessToken: "db-access-token",
    refreshToken: "db-refresh",
    accessExpiresAt: Date.now() + 300_000,
  },
})
beforeEach(() => {
  for (const mock of Object.values(fixture)) mock.mockReset()
  fixture.credentials.mockResolvedValue(session())
  fixture.verify.mockResolvedValue({
    sub: "sso-sub",
    sid: "central-sid",
    scope: "chat:read chat:write",
  })
  fixture.profile.mockResolvedValue({
    sub: "sso-sub",
    name: "User",
    email: "user@example.test",
    status: "active",
  })
  fixture.local.mockResolvedValue(account())
})

it("uses the native app session without token verification and reuses its local user projection", async () => {
  const response = await app.request("/private", {
    headers: { Cookie: cookie },
  })
  expect(response.status).toBe(200)
  expect(fixture.credentials).toHaveBeenCalledExactlyOnceWith(
    expect.any(Headers)
  )
  expect(fixture.verify).not.toHaveBeenCalled()
  expect(fixture.local).not.toHaveBeenCalled()
  expect(await response.json()).toMatchObject({
    user: { id: "sso-sub" },
    localRole: "local-admin",
  })
  expect(response.headers.getSetCookie()).toHaveLength(0)
})

it("checks Origin before cookie-authenticated writes without requiring an OAuth token", async () => {
  for (const origin of [undefined, "https://evil.example.test"])
    expect(
      (
        await app.request("/private", {
          method: "POST",
          headers: { Cookie: cookie, ...(origin ? { Origin: origin } : {}) },
        })
      ).status
    ).toBe(403)
  expect(fixture.credentials).not.toHaveBeenCalled()
  const response = await app.request("/private", {
    method: "POST",
    headers: { Cookie: cookie, Origin: "https://chat.example.test" },
  })
  expect(response.status).toBe(200)
  expect(fixture.credentials).toHaveBeenCalledExactlyOnceWith(
    expect.any(Headers)
  )
  expect(fixture.verify).not.toHaveBeenCalled()
})

it("a standalone access-token cookie cannot bypass local app logout", async () => {
  fixture.credentials.mockResolvedValue(null)
  expect(
    (await app.request("/private", { headers: { Cookie: cookie } })).status
  ).toBe(401)
  expect(
    (
      await app.request("/private", {
        headers: { Cookie: "gorth.access_token=old-token" },
      })
    ).status
  ).toBe(401)
  expect(fixture.verify).not.toHaveBeenCalled()
})

it("rejects cross-site cookie reads before consulting the session store", async () => {
  const response = await app.request("/private", {
    headers: { Cookie: cookie, Origin: "https://evil.example.test" },
  })
  expect(response.status).toBe(403)
  expect(fixture.credentials).not.toHaveBeenCalled()
})

it("external bearer APIs remain independent of user app cookies", async () => {
  const response = await app.request("/private", {
    method: "POST",
    headers: { Authorization: "Bearer external-service-token" },
  })
  expect(response.status).toBe(200)
  expect(fixture.credentials).not.toHaveBeenCalled()
  expect(fixture.verify).toHaveBeenCalledWith(
    expect.any(Request),
    ["chat:write"],
    "external-service-token",
    expect.objectContaining({})
  )
  expect(fixture.local).toHaveBeenCalledWith("sso-sub")
})

it("keeps durable revocation rejection on native cookie requests", async () => {
  fixture.credentials.mockRejectedValue(new AuthError("forbidden"))
  expect(
    (await app.request("/private", { headers: { Cookie: cookie } })).status
  ).toBe(403)
  expect(fixture.profile).not.toHaveBeenCalled()
})

it("checks local ban/delete status and fails closed on backend outages", async () => {
  fixture.credentials.mockResolvedValue({
    ...session(),
    user: { ...account(), bannedAt: new Date() },
  })
  expect(
    (await app.request("/private", { headers: { Cookie: cookie } })).status
  ).toBe(403)
  fixture.credentials.mockRejectedValue(new AuthError("unavailable"))
  expect(
    (await app.request("/private", { headers: { Cookie: cookie } })).status
  ).toBe(503)
})
it("does not interpret native sessions as OAuth access tokens", async () => {
  fixture.verify.mockRejectedValue(new Error("expired legacy access token"))
  fixture.profile.mockRejectedValue(new Error("SSO is offline"))
  const response = await app.request("/private", {
    headers: { Cookie: cookie },
  })
  expect(response.status).toBe(200)
  expect(fixture.verify).not.toHaveBeenCalled()
  expect(fixture.profile).not.toHaveBeenCalled()
  expect(await response.json()).toMatchObject({ verifiedBy: "better-auth" })
})

it("reports infrastructure failures as unavailable instead of invalid access tokens", async () => {
  fixture.credentials.mockRejectedValue(new Error("DB connection failed"))
  const response = await app.request("/private", {
    headers: { Cookie: cookie },
  })
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ error: "auth_unavailable" })
})
it("checks a stale identity through native provider refresh before local access", async () => {
  fixture.credentials.mockResolvedValue({
    ...session(),
    user: { ...account(), syncedAt: new Date(Date.now() - 120_001) },
  })
  expect(
    (await app.request("/private", { headers: { Cookie: cookie } })).status
  ).toBe(200)
  expect(fixture.credentials).toHaveBeenCalledWith(expect.any(Headers), true)
  expect(fixture.verify).not.toHaveBeenCalled()
})
