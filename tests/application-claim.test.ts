import { expect, it, vi } from "vitest"
import { Hono } from "hono"

vi.mock("server-only", () => ({}))
const fixture = vi.hoisted(() => ({
  authority: "https://identity.example.test",
  claims: {} as Record<string, unknown>,
}))
vi.mock("@/utils/environment", () => ({
  get authUrl() { return fixture.authority },
  oauthCookiePrefix: "fixture",
  oauthReadScope: "fixture:read",
  oauthWriteScope: "fixture:write",
  isProduction: false,
}))
vi.mock("@/lib/auth/config", () => ({
  assertSessionOrigin: () => {},
  assertSameOrigin: () => {},
  assertSessionReadOrigin: () => {},
}))
vi.mock("@/models/session", () => ({
  rawReadAppIdentity: vi.fn(),
  rawReadAppCredentials: vi.fn(),
  rawReadAuthenticatedIdentity: vi.fn(),
}))
vi.mock("@/services/sso", () => ({
  rawVerifySsoAccessTokenRequest: async () => ({ sub: "subject", scope: "fixture:read" }),
  rawGetVerifiedSsoUserInfo: async () => ({ sub: "subject", email: "user@example.test", status: "active", ...fixture.claims }),
}))
vi.mock("@/models/user", () => ({ rawFindUserByExternalId: async () => null }))
import { requireAuth } from "@/middlewares/auth"

it.each(["https://identity.example.test", "http://localhost:3000/"])(
  "reads the verified application claim from the configured auth origin %s",
  async (authority) => {
    fixture.authority = authority
    const application = { id: "client-fixture", name: "Application" }
    fixture.claims = { [new URL("/claims/app", authority).href]: application }
    const app = new Hono()
    app.get("/probe", requireAuth(), (context) => context.json(context.get("auth").app))
    const response = await app.request("/probe", { headers: { Authorization: "Bearer fixture" } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(application)
  }
)
