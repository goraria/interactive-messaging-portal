import { beforeEach, expect, it, vi } from "vitest"

const validEnvironment = {
  oauthCookiePrefix: "gorth",
  appUrl: "http://localhost:3030",
  authUrl: "http://localhost:3000",
  oauthClientId: "chat-fixture",
  sessionSecret: "fixture-only-session-secret-at-least-32-bytes",
  oauthAudience: "http://localhost:3030",
  oauthNotifyAudience: "http://localhost:7072",
  oauthResourceAudience: "http://localhost:7073",
  oauthDiscoveryAudience: "http://localhost:7074",
  oauthPaymentAudience: "",
  oauthBillingAudience: "",
  oauthMediaAudience: "",
  oauthInsightAudience: "",
  isProduction: false,
}

beforeEach(() => {
  vi.resetModules()
})

it("keeps the Chat audience separate from the seven optional service audiences", async () => {
  vi.doMock("@/utils/environment", () => ({ ...validEnvironment }))
  const { getAuthConfig } = await import("@/lib/auth/config")
  const config = getAuthConfig()
  expect(config.redirectUri).toBe("http://localhost:3030/auth/callback/gorth")
  expect(config.ssoOrigin).toBe("http://localhost:3000")
  expect(config.issuer).toBe("http://localhost:3000/auth")
  expect(config.clientId).toBe("chat-fixture")
  expect(config).not.toHaveProperty("serverOrigin")
  expect(config.resources).toEqual([
    "http://localhost:3030",
    "http://localhost:7072",
    "http://localhost:7073",
    "http://localhost:7074",
  ])
})

it("fails closed for missing root env and logs names without values or secrets", async () => {
  vi.doMock("@/utils/environment", () => ({
    ...validEnvironment,
    authUrl: "",
    oauthAudience: "",
    sessionSecret: "",
  }))
  const log = vi.spyOn(console, "error").mockImplementation(() => {})
  const { getAuthConfig } = await import("@/lib/auth/config")
  expect(getAuthConfig).toThrow("Authentication invalid configuration")
  expect(log).toHaveBeenCalledExactlyOnceWith("[auth/config]", {
    missingVariables: [
      "NEXT_PUBLIC_AUTH_URL",
      "NEXT_OAUTH_AUDIENCE",
      "NEXT_SESSION_SECRET",
    ],
    invalidVariables: [],
  })
  expect(JSON.stringify(log.mock.calls)).not.toContain(
    validEnvironment.sessionSecret
  )
  expect(JSON.stringify(log.mock.calls)).not.toContain(validEnvironment.appUrl)
})
it.each(["", "bad prefix", "bad;prefix"])("rejects invalid cookie prefix %s", async (prefix) => {
  vi.doMock("@/utils/environment", () => ({ ...validEnvironment, oauthCookiePrefix: prefix }))
  const { getAuthConfig } = await import("@/lib/auth/config")
  expect(getAuthConfig).toThrow("NEXT_OAUTH_COOKIE_PREFIX")
})
