import { beforeEach, expect, it, vi } from "vitest"
import { Hono } from "hono"
import { AuthError } from "@gorth/structure/modules/auth/server"

const fixture = vi.hoisted(() => ({
  credentials: vi.fn(),
  start: vi.fn(),
  finish: vi.fn(),
  create: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock("@/utils/environment", () => ({
  clientUrl: "https://chat.example.test",
  serverUrl: "https://chat-api.example.test",
  ssoClientUrl: "https://sso.example.test",
  ssoServerUrl: "https://sso-api.example.test",
  ssoOAuthClientId: "chat",
  sessionSecret: "fixture-only-session-secret-at-least-32-bytes",
  isProduction: true,
  oauthResources: "https://resource.example.test https://notify.example.test",
  accessTokenCookie: "gorth.access_token",
  refreshTokenCookie: "gorth.refresh_token",
  sessionAppCookie: "gorth.session_app",
  oauthStateCookie: "gorth.oauth_state",
  oauthCodeVerifierCookie: "gorth.oauth_code_verifier",
  oauthReturnToCookie: "gorth.oauth_return_to",
  oauthIssuerCookie: "gorth.oauth_issuer",
  oauthNonceCookie: "gorth.oauth_nonce",
}))
vi.mock("@/lib/auth/runtime", () => ({
  getAuthRuntime: () => ({
    credentials: fixture.credentials,
    signOut: fixture.signOut,
    provider: { startLogin: fixture.start, finishLogin: fixture.finish },
    sessions: { create: fixture.create },
  }),
}))
import routes from "@/routes/session"
import { getAuthConfig, openAuthData, sealAuthData } from "@/lib/auth/config"

const app = new Hono().route("/auth", routes)
const handle = "h".repeat(43)
const cookie = "gorth.session_app=" + handle
const record = () => ({
  subject: "sso-sub",
  expiresAt: Date.now() + 600_000,
  user: {
    id: "local-uuid",
    externalUserId: "sso-sub",
    name: "User",
    email: "user@example.test",
    username: null,
    image: null,
  },
  credentials: {
    accessToken: "server-access-token",
    refreshToken: "server-refresh-token",
    accessExpiresAt: Date.now() + 300_000,
  },
})
const transaction = () => ({
  state: "s".repeat(43),
  verifier: "v".repeat(43),
  nonce: "n".repeat(43),
  issuer: "https://sso.example.test/auth",
  clientId: "chat",
  redirectUri: "https://chat.example.test/auth/exchange",
  returnTo: "/chat",
  expiresAt: Date.now() + 120_000,
})
beforeEach(() => {
  vi.restoreAllMocks()
  for (const mock of Object.values(fixture)) mock.mockReset()
  fixture.credentials.mockResolvedValue(record())
  fixture.start.mockImplementation(async () => ({
    url: "https://sso.example.test/auth/oauth2/authorize",
    transaction: transaction(),
  }))
  fixture.finish.mockResolvedValue({ returnTo: "/chat" })
  fixture.create.mockResolvedValue({
    handle,
    session: { expiresAt: Date.now() + 600_000 },
  })
  fixture.signOut.mockResolvedValue({ remoteRevoked: true })
})

it("uses backend-owned resources, never caller-provided audiences", () => {
  expect(getAuthConfig().resources).toEqual([
    "https://chat-api.example.test",
    "https://resource.example.test",
    "https://notify.example.test",
  ])
})

it.each([
  ["sign-in", "select_account"],
  ["sign-up", "create"],
  ["unknown", "select_account"],
])(
  "starts %s with an encrypted 120-second cookie without HMAC RPC",
  async (mode, prompt) => {
    const response = await app.request(
      "/auth/start?mode=" +
        mode +
        "&returnTo=%2Fchat&resources=https://evil.test"
    )
    expect(response.status).toBe(302)
    expect(fixture.start).toHaveBeenCalledExactlyOnceWith("/chat", prompt)
    expect(response.headers.get("location")).toBe(
      "https://sso.example.test/auth/oauth2/authorize"
    )
    const issued = response.headers.getSetCookie()[0]!
    for (const flag of [
      "Max-Age=120",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Path=/auth",
    ])
      expect(issued).toContain(flag)
    expect(issued).not.toContain("v".repeat(43))
    const value = decodeURIComponent(
      issued.split(";", 1)[0]!.slice("gorth.oauth_state=".length)
    )
    expect(await openAuthData(value, "transaction")).toMatchObject({
      state: "s".repeat(43),
      verifier: "v".repeat(43),
    })
    expect(response.headers.get("cache-control")).toBe("no-store")
  }
)

it("exchanges on Hono with the configured callback, ignoring forged proxy hosts", async () => {
  const pending = transaction()
  const value = await sealAuthData(
    pending,
    "transaction",
    new Date(pending.expiresAt)
  )
  const response = await app.request(
    "https://internal.example.test/auth/exchange?code=fixture&state=" +
      pending.state,
    {
      headers: {
        Cookie: "gorth.oauth_state=" + value,
        "X-Forwarded-Host": "evil.example.test",
      },
    }
  )
  expect(fixture.finish).toHaveBeenCalledExactlyOnceWith(
    "https://chat.example.test/auth/exchange?code=fixture&state=" +
      pending.state,
    pending
  )
  expect(response.headers.get("location")).toBe(
    "https://chat.example.test/chat"
  )
  expect(
    response.headers.getSetCookie().some((value) => value.startsWith(cookie))
  ).toBe(true)
  expect(
    response.headers
      .getSetCookie()
      .some(
        (value) =>
          value.startsWith("gorth.oauth_state=") && value.includes("Max-Age=0")
      )
  ).toBe(true)
})

it("rejects expired, tampered and missing transactions before creating sessions", async () => {
  const pending = transaction()
  const sealed = await sealAuthData(
    pending,
    "transaction",
    new Date(pending.expiresAt)
  )
  for (const value of ["", sealed + "corrupted"]) {
    const response = await app.request("/auth/exchange?code=fixture", {
      headers: { Cookie: "gorth.oauth_state=" + value + "; " + cookie },
    })
    expect(response.headers.get("location")).toBe(
      "https://chat.example.test/?auth=failed"
    )
    expect(response.headers.getSetCookie().join(";")).not.toContain(
      "gorth.session_app="
    )
  }
  const now = Date.now()
  vi.spyOn(Date, "now").mockReturnValue(now + 121_000)
  await app.request("/auth/exchange?code=fixture", {
    headers: { Cookie: "gorth.oauth_state=" + sealed },
  })
  expect(fixture.finish).not.toHaveBeenCalled()
  expect(fixture.create).not.toHaveBeenCalled()
})

it("cancellation preserves the previous app session and redirects locally", async () => {
  const response = await app.request(
    "/auth/exchange?error=access_denied&state=fixture",
    { headers: { Cookie: cookie } }
  )
  expect(response.headers.get("location")).toBe(
    "https://chat.example.test/?auth=cancelled"
  )
  expect(response.headers.getSetCookie().join(";")).not.toContain(
    "gorth.session_app="
  )
  expect(fixture.create).not.toHaveBeenCalled()
})

it("reads the opaque handle and returns only public user/session fields", async () => {
  const response = await app.request("/auth/me?fresh=1", {
    headers: { Cookie: cookie + "; gorth.access_token=stale" },
  })
  expect(fixture.credentials).toHaveBeenCalledExactlyOnceWith(handle, true)
  const body = await response.text()
  expect(body).toContain('"id":"sso-sub"')
  expect(body).not.toMatch(
    /local-uuid|credentials|accessToken|server-access-token|server-refresh-token/
  )
  expect(response.headers.getSetCookie().join(";")).toContain(
    "gorth.access_token=server-access-token"
  )
  expect(response.headers.get("Server-Timing")).toMatch(/^auth;dur=[0-9.]+$/)
})

it.each([
  "gorth.access_token=standalone",
  cookie + "; gorth.session_app=" + "b".repeat(43),
  "gorth.session_app=malformed",
])("does not accept token-only or ambiguous cookies (%s)", async (value) => {
  expect(
    (await app.request("/auth/me", { headers: { Cookie: value } })).status
  ).toBe(401)
  expect(fixture.credentials).not.toHaveBeenCalled()
})

it("clears invalid sessions but preserves cookies on DB/SSO outages", async () => {
  fixture.credentials.mockResolvedValue(null)
  const expired = await app.request("/auth/me", { headers: { Cookie: cookie } })
  expect(expired.status).toBe(401)
  expect(expired.headers.getSetCookie().join(";")).toContain("Max-Age=0")
  fixture.credentials.mockRejectedValue(new AuthError("unavailable"))
  const outage = await app.request("/auth/me", { headers: { Cookie: cookie } })
  expect(outage.status).toBe(503)
  expect(outage.headers.getSetCookie()).toHaveLength(0)
})

it("blocks cross-site reads/logout before storage, even with bearer headers", async () => {
  for (const headers of [
    { Origin: "https://evil.example.test" },
    { "Sec-Fetch-Site": "cross-site" },
  ])
    expect((await app.request("/auth/me", { headers })).status).toBe(403)
  for (const origin of [undefined, "https://evil.example.test"])
    expect(
      (
        await app.request("/auth/me", {
          method: "DELETE",
          headers: {
            Cookie: cookie,
            Authorization: "Bearer bypass",
            ...(origin ? { Origin: origin } : {}),
          },
        })
      ).status
    ).toBe(403)
  expect(fixture.credentials).not.toHaveBeenCalled()
  expect(fixture.signOut).not.toHaveBeenCalled()
})

it("local logout blocks later reads even if remote grant revocation is pending", async () => {
  fixture.signOut.mockImplementation(async () => {
    fixture.credentials.mockResolvedValue(null)
    return { remoteRevoked: false }
  })
  const response = await app.request("/auth/me", {
    method: "DELETE",
    headers: { Origin: "https://chat.example.test", Cookie: cookie },
  })
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ user: null })
  expect(fixture.signOut).toHaveBeenCalledExactlyOnceWith(handle)
  expect(response.headers.get("X-Gorth-Revocation")).toBe("pending")
  expect(response.headers.get("location")).toBeNull()
  expect(response.headers.getSetCookie().join(";")).not.toMatch(
    /session_token|multi_session/
  )
  expect(
    (await app.request("/auth/me", { headers: { Cookie: cookie } })).status
  ).toBe(401)
})

it("does not claim logout success or delete cookies when durable deletion fails", async () => {
  fixture.signOut.mockRejectedValue(new Error("database-unavailable"))
  const response = await app.request("/auth/me", {
    method: "DELETE",
    headers: { Origin: "https://chat.example.test", Cookie: cookie },
  })
  expect(response.status).toBe(503)
  expect(response.headers.getSetCookie()).toHaveLength(0)
})

it("permanently rejects the old credential RPC even with HMAC headers", async () => {
  const response = await app.request("/auth/session", {
    method: "POST",
    headers: { "x-bff-signature": "legacy" },
    body: JSON.stringify({ operation: "read", handle }),
  })
  expect(response.status).toBe(404)
  expect(fixture.credentials).not.toHaveBeenCalled()
})
