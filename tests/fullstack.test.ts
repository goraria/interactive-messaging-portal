import { beforeEach, expect, it, vi } from "vitest"
import { AuthError } from "@gorth-io/structure/modules/auth/server"

const fixture = vi.hoisted(() => ({
  credentials: vi.fn(),
  verify: vi.fn(),
  profile: vi.fn(),
  users: vi.fn(),
  current: vi.fn(),
  update: vi.fn(),
  forward: vi.fn(),
}))
vi.mock("@/utils/environment", () => ({
  oauthCookiePrefix: "gorth",
  appUrl: "https://chat.example.test",
  oauthAudience: "https://chat-api.example.test",
  authUrl: "https://sso.example.test",
  oauthClientId: "chat",
  sessionSecret: "fixture-only-session-key-at-least-32-bytes",
  sessionMaxAgeSeconds: "2592000",
  oauthNotifyAudience: "https://notify.example.test",
  oauthResourceAudience: "https://resource.example.test",
  oauthDiscoveryAudience: "https://discovery.example.test",
  oauthPaymentAudience: "https://payment.example.test",
  oauthBillingAudience: "https://billing.example.test",
  oauthMediaAudience: "https://media.example.test",
  oauthInsightAudience: "https://insight.example.test",
  isProduction: true,
  rateLimitEnabled: false,
  databaseUrl: "",
  pgPoolMax: "5",
  sessionAppCookie: "gorth.session_token",
  accessTokenCookie: "gorth.access_token",
  refreshTokenCookie: "gorth.refresh_token",
  oauthStateCookie: "gorth.oauth_state",
  oauthCodeVerifierCookie: "gorth.oauth_code_verifier",
  oauthReturnToCookie: "gorth.oauth_return_to",
  oauthIssuerCookie: "gorth.oauth_issuer",
  oauthNonceCookie: "gorth.oauth_nonce",
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
  getOAuthProtectedResourceMetadata: () => ({
    resource: "https://chat-api.example.test",
  }),
}))
vi.mock("@/services/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/users")>()),
  listUsers: fixture.users,
  getCurrentUserRow: fixture.current,
  updateUser: fixture.update,
}))
vi.mock("@/services/route", () => ({ forwardRouteRequest: fixture.forward }))
vi.mock("@/lib/auth/server", () => ({
  getAuth: () => ({ handler: () => new Response(null, { status: 404 }) }),
}))
vi.mock("@/services/revocation", () => ({
  verifyBackchannelLogoutToken: vi.fn(),
  endSsoSessions: vi.fn(),
}))
import { createApp } from "@/app/api"
import { getAuthConfig } from "@/lib/auth/config"
import { createServiceError } from "@/utils/service"

const handle = "h".repeat(43)
const cookie = "gorth.session_token=" + handle
const app = createApp()
const account = {
  syncedAt: new Date(),
  id: "local-user",
  externalUserId: "sso-sub",
  email: "user@example.test",
  name: "User",
  username: null,
  image: null,
  status: "active",
  role: "user",
  bannedAt: null,
  deletedAt: null,
}
beforeEach(() => {
  Object.values(fixture).forEach((mock) => mock.mockReset())
  fixture.credentials.mockResolvedValue({
    subject: "sso-sub",
    user: account,
    expiresAt: Date.now() + 600000,
    credentials: {
      accessToken: "private-access",
      refreshToken: "private-refresh",
      accessExpiresAt: Date.now() + 300000,
    },
  })
  fixture.verify.mockResolvedValue({
    sub: "sso-sub",
    scope: "chat:read chat:write",
    sid: "sso-sid",
  })
  fixture.profile.mockResolvedValue({
    sub: "sso-sub",
    email: account.email,
    name: account.name,
    status: "active",
  })
  fixture.users.mockResolvedValue([])
  fixture.current.mockResolvedValue(account)
  fixture.update.mockResolvedValue({ name: "Updated" })
  fixture.forward.mockResolvedValue(
    Response.json(
      { data: [] },
      { headers: { "Set-Cookie": "gorth.session_token=untrusted-upstream" } }
    )
  )
})

it("health and anonymous APIs do not initialize DB or contact another Chat server", async () => {
  expect((await app.request("/health")).status).toBe(200)
  expect((await app.request("/chat/user")).status).toBe(401)
  expect((await app.request("/chat/conversation")).status).toBe(401)
  expect(fixture.credentials).not.toHaveBeenCalled()
  expect(fixture.forward).not.toHaveBeenCalled()
})

it("keeps domain payloads and requires the Chat token scopes", async () => {
  const response = await app.request("/chat/user?limit=10", {
    headers: { Cookie: cookie },
  })
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ data: [] })
  expect(fixture.users).toHaveBeenCalledWith(10)
  expect(fixture.verify).not.toHaveBeenCalled()
  expect(response.headers.get("cache-control")).toBe("no-store")
})

it("validates JSON with native Hono Context and preserves controller status codes", async () => {
  const request = (body: string) =>
    app.request("/chat/user/local-user", {
      method: "PATCH",
      headers: {
        Cookie: cookie,
        Origin: "https://chat.example.test",
        "Content-Type": "application/json",
      },
      body,
    })
  const invalid = await request("{")
  expect(invalid.status).toBe(400)
  expect(await invalid.json()).toEqual({ error: "invalid_json" })
  expect(fixture.update).not.toHaveBeenCalled()
  const valid = await request(JSON.stringify({ name: "Updated" }))
  expect(valid.status).toBe(200)
  expect(fixture.update).toHaveBeenCalledWith(
    "local-user",
    expect.objectContaining({ name: "Updated" })
  )
})

it("does not report downstream domain and DB errors as invalid access tokens", async () => {
  fixture.users.mockRejectedValue(createServiceError(404, "user_not_found"))
  const domain = await app.request("/chat/user", {
    headers: { Cookie: cookie },
  })
  expect(domain.status).toBe(404)
  expect(await domain.json()).toEqual({ error: "user_not_found" })
  fixture.users.mockRejectedValue(new Error("private connection details"))
  const unavailable = await app.request("/chat/user", {
    headers: { Cookie: cookie },
  })
  expect(unavailable.status).toBe(500)
  expect(await unavailable.json()).toEqual({ error: "internal_server_error" })
})

it("forwards only the access token to the owning platform and preserves app cookies", async () => {
  const response = await app.request("/notification?limit=3", {
    headers: { Cookie: cookie },
  })
  expect(response.status).toBe(200)
  const options = fixture.forward.mock.calls[0]![0]
  expect(options.url.href).toBe(
    "https://notify.example.test/notification?limit=3"
  )
  expect(options.headers.get("authorization")).toBe("Bearer private-access")
  expect(options.headers.has("cookie")).toBe(false)
  expect(options.headers.has("x-bff-signature")).toBe(false)
  expect(response.headers.getSetCookie()).toHaveLength(0)
  expect(response.headers.getSetCookie().join(";")).not.toContain(
    "untrusted-upstream"
  )
  expect(await response.text()).not.toContain("private-access")
})

it("logout fences platform forwarding and cross-site mutations fail before session reads", async () => {
  fixture.credentials.mockResolvedValue(null)
  expect(
    (await app.request("/resource/item", { headers: { Cookie: cookie } }))
      .status
  ).toBe(401)
  expect(fixture.forward).not.toHaveBeenCalled()
  fixture.credentials.mockClear()
  const denied = await app.request("/notification", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://evil.example.test",
      "Content-Type": "application/json",
    },
    body: "{}",
  })
  expect(denied.status).toBe(403)
  expect(fixture.credentials).not.toHaveBeenCalled()
})

it("distinguishes unknown endpoints and unsupported methods", async () => {
  expect((await app.request("/does-not-exist")).status).toBe(404)
  const response = await app.request("/auth/get-session", {
    method: "PUT",
    headers: { Origin: "https://chat.example.test" },
  })
  expect(response.status).toBe(405)
  expect(response.headers.get("allow")).toContain("POST")
})

it("keeps all seven configured service audiences separate from caller input", () => {
  expect(getAuthConfig().resources).toEqual([
    "https://chat-api.example.test",
    "https://notify.example.test",
    "https://resource.example.test",
    "https://discovery.example.test",
    "https://payment.example.test",
    "https://billing.example.test",
    "https://media.example.test",
    "https://insight.example.test",
  ])
})

it("does not grant platform forwarding when the session store is unavailable", async () => {
  fixture.credentials.mockRejectedValue(new AuthError("unavailable"))
  const response = await app.request("/notification", {
    headers: { Cookie: cookie },
  })
  expect(response.status).toBe(503)
  expect(fixture.forward).not.toHaveBeenCalled()
  expect(response.headers.getSetCookie()).toHaveLength(0)
})
