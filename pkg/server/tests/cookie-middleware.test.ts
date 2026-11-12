import { beforeEach, expect, it, vi } from "vitest"
import { Hono } from "hono"
import { AuthError } from "@gorth/structure/modules/auth/server"

const fixture = vi.hoisted(() => ({
  credentials: vi.fn(),
  verify: vi.fn(),
  profile: vi.fn(),
  local: vi.fn(),
}))
vi.mock("@/utils/environment", () => ({
  clientUrl: "https://chat.example.test",
  serverUrl: "https://chat-api.example.test",
  ssoClientUrl: "https://sso.example.test",
  ssoServerUrl: "https://sso-api.example.test",
  ssoOAuthClientId: "chat",
  sessionSecret: "fixture-only-session-key-at-least-32-bytes",
  oauthResources: "",
  isProduction: true,
  sessionAppCookie: "gorth.session_app",
  accessTokenCookie: "gorth.access_token",
  refreshTokenCookie: "gorth.refresh_token",
  oauthReadScope: "chat:read",
  oauthWriteScope: "chat:write",
}))
vi.mock("@/lib/auth/runtime", () => ({
  getAuthRuntime: () => ({ credentials: fixture.credentials }),
}))
vi.mock("@/services/sso", () => ({
  verifySsoAccessTokenRequest: fixture.verify,
  getVerifiedSsoUserInfo: fixture.profile,
}))
vi.mock("@/services/users", () => ({ findUserByExternalId: fixture.local }))
import { Router } from "@/lib/http"
import { requireAuth } from "@/middlewares/auth"

const routes = Router()
routes.get("/private", requireAuth(), (_request, response) =>
  response.json(response.locals.auth)
)
routes.post("/private", requireAuth(), (_request, response) =>
  response.json(response.locals.auth)
)
const app = new Hono().route("/", routes.hono)
const handle = "a".repeat(43)
const cookie =
  "gorth.session_app=" + handle + "; gorth.access_token=untrusted-cookie"
const account = () => ({
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

it("checks the cookie session once, verifies API scopes, and reuses its local user projection", async () => {
  const response = await app.request("/private", {
    headers: { Cookie: cookie },
  })
  expect(response.status).toBe(200)
  expect(fixture.credentials).toHaveBeenCalledExactlyOnceWith(handle, false)
  expect(fixture.verify).toHaveBeenCalledWith(
    expect.any(Request),
    ["chat:read"],
    "db-access-token",
    expect.objectContaining({
      session: expect.objectContaining({ subject: "sso-sub" }),
    })
  )
  expect(fixture.local).not.toHaveBeenCalled()
  expect(await response.json()).toMatchObject({
    user: { id: "sso-sub" },
    localRole: "local-admin",
  })
  expect(response.headers.getSetCookie().join(";")).toContain(
    "gorth.access_token=db-access-token"
  )
})

it("forces fresh identity and checks Origin before all cookie-authenticated writes", async () => {
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
  expect(fixture.credentials).toHaveBeenCalledExactlyOnceWith(handle, true)
  expect(fixture.verify.mock.calls[0]![1]).toEqual(["chat:write"])
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
    expect.objectContaining({ session: undefined })
  )
  expect(fixture.local).toHaveBeenCalledWith("sso-sub")
})

it("keeps audience/scope/revocation rejection on cookie requests", async () => {
  fixture.verify.mockRejectedValue(new AuthError("forbidden"))
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
