import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const fixture = vi.hoisted(() => ({
  cookie: "a".repeat(43),
  unavailable: false,
  removed: false,
  remoteRevoked: true,
  logoutUrl: vi.fn(),
  secret: "test-only-secret-not-for-deployment-at-least-32-bytes",
}))
vi.mock("@/utils/environment", () => ({
  nodeEnv: "production",
  appUrl: "https://website.example.test",
  ssoClientUrl: "https://sso.example.test",
  ssoServerUrl: "https://sso-api.example.test",
  ssoOAuthClientId: "fixture-website",
  authSecret: fixture.secret,
  sessionMaxAgeSeconds: "2592000",
  sessionAppCookie: "gorth.session_app",
  accessTokenCookie: "gorth.access_token",
  refreshTokenCookie: "gorth.refresh_token",
  oauthStateCookie: "gorth.oauth_state",
  oauthCodeVerifierCookie: "gorth.oauth_verifier",
  oauthNonceCookie: "gorth.oauth_nonce",
  oauthIssuerCookie: "gorth.oauth_issuer",
  oauthReturnToCookie: "gorth.oauth_return",
}))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "gorth.session_app" && fixture.cookie
        ? { value: fixture.cookie }
        : undefined,
  }),
}))
vi.mock("@/lib/auth/runtime", () => ({
  getAuthRuntime: () => ({
    sessions: {
      get: async () => {
        if (fixture.unavailable) throw new Error("unavailable")
        if (fixture.removed) return null
        return {
          expiresAt: Date.now() + 600_000,
          user: {
            id: "local-user-uuid",
            externalUserId: "sso-subject",
            role: "local-admin",
            status: "active",
            name: "Test User",
            email: "user@example.test",
            username: null,
            image: null,
          },
        }
      },
    },
    credentials: async () => {
      if (fixture.unavailable) throw new Error("unavailable")
      return fixture.removed
        ? null
        : {
            expiresAt: Date.now() + 600_000,
            user: {
              id: "local-user-uuid",
              externalUserId: "sso-subject",
              role: "local-admin",
              status: "active",
              name: "Test User",
              email: "user@example.test",
              username: null,
              image: null,
            },
            credentials: {
              subject: "sso-subject",
              nonce: "b".repeat(43),
              accessToken: "private-access",
              refreshToken: "private-refresh",
              accessExpiresAt: Date.now() + 600_000,
            },
          }
    },
    signOut: async () => {
      if (fixture.unavailable) throw new Error("unavailable")
      fixture.removed = true
      return { remoteRevoked: fixture.remoteRevoked }
    },
    provider: {
      logoutUrl: fixture.logoutUrl,
    },
  }),
}))
import { GET, DELETE, POST as signOut } from "@/app/(api)/[...route]/route"
beforeEach(() => {
  fixture.removed = false
  fixture.unavailable = false
  fixture.cookie = "a".repeat(43)
  fixture.remoteRevoked = true
  fixture.logoutUrl.mockClear()
})
describe("reference website app sessions", () => {
  it("the account-page form redirects to app home, never the SSO confirmation", async () => {
    const response = await signOut(
      new NextRequest("https://website.example.test/auth/sign-out", {
        method: "POST",
        headers: { Origin: "https://website.example.test" },
      })
    )
    expect(response.status).toBe(303)
    expect(response.headers.get("Location")).toBe(
      "https://website.example.test/"
    )
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(fixture.removed).toBe(true)
    expect(fixture.logoutUrl).not.toHaveBeenCalled()
  })
  it("the form still rejects absent or foreign origins without deleting a session", async () => {
    for (const origin of [undefined, "https://evil.example.test"]) {
      const response = await signOut(
        new NextRequest("https://website.example.test/auth/sign-out", {
          method: "POST",
          headers: origin ? { Origin: origin } : {},
        })
      )
      expect(response.status).toBe(403)
      expect(fixture.removed).toBe(false)
    }
  })
  it("returns public session data without tokens or central/local roles", async () => {
    const response = await GET(
      new NextRequest("https://website.example.test/auth/me?fresh=1")
    )
    expect(response.status).toBe(200)
    const json = await response.text()
    expect(json).toContain("local-user-uuid")
    expect(json).not.toContain("private-access")
    expect(json).not.toContain("private-refresh")
    expect(json).not.toContain("local-admin")
    const cookies = response.headers.getSetCookie()
    expect(cookies.join(";")).toContain("HttpOnly")
  })
  it("rejects cross-site logout and deletes only the app session without offering an SSO logout URL", async () => {
    const bad = await DELETE(
      new NextRequest("https://website.example.test/auth/me", {
        method: "DELETE",
        headers: { Origin: "https://evil.example.test" },
      })
    )
    expect(bad.status).toBe(403)
    expect(fixture.removed).toBe(false)
    const logout = await DELETE(
      new NextRequest("https://website.example.test/auth/me", {
        method: "DELETE",
        headers: { Origin: "https://website.example.test" },
      })
    )
    expect(logout.status).toBe(200)
    expect(fixture.removed).toBe(true)
    expect(await logout.json()).toEqual({ user: null })
    expect(logout.headers.has("Location")).toBe(false)
    expect(fixture.logoutUrl).not.toHaveBeenCalled()
    const cookies = logout.headers.getSetCookie()
    for (const name of [
      "gorth.session_app",
      "gorth.access_token",
      "gorth.refresh_token",
      "gorth.oauth_state",
    ]) {
      expect(
        cookies.some(
          (value) => value.startsWith(name + "=") && value.includes("Max-Age=0")
        )
      ).toBe(true)
    }
    expect(
      cookies.some((value) => value.startsWith("gorth.session_token="))
    ).toBe(false)
    expect(
      (await GET(new NextRequest("https://website.example.test/auth/me")))
        .status
    ).toBe(401)
  })
  it("still clears the app cookies when only remote grant revocation is pending", async () => {
    fixture.remoteRevoked = false
    const response = await DELETE(
      new NextRequest("https://website.example.test/auth/me", {
        method: "DELETE",
        headers: { Origin: "https://website.example.test" },
      })
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("X-Gorth-Revocation")).toBe("pending")
    expect(await response.json()).toEqual({ user: null })
    expect(fixture.removed).toBe(true)
    expect(fixture.logoutUrl).not.toHaveBeenCalled()
  })
  it("does not falsely acknowledge logout or clear cookies when database deletion fails", async () => {
    fixture.unavailable = true
    const response = await DELETE(
      new NextRequest("https://website.example.test/auth/me", {
        method: "DELETE",
        headers: { Origin: "https://website.example.test" },
      })
    )
    expect(response.status).toBe(503)
    expect(fixture.removed).toBe(false)
    expect(response.headers.getSetCookie()).toHaveLength(0)
  })
  it("keeps the browser session cookie on a transient SSO/DB failure", async () => {
    fixture.unavailable = true
    const response = await GET(
      new NextRequest("https://website.example.test/auth/me")
    )
    expect(response.status).toBe(503)
    expect(
      response.headers
        .getSetCookie()
        .some((value) => value.startsWith("gorth.session_app="))
    ).toBe(false)
  })
})
