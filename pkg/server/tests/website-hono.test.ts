import { beforeEach, describe, expect, it, vi } from "vitest"
import { AuthError } from "@gorth/structure/modules/auth/server"

const fixture = vi.hoisted(() => ({
  read: vi.fn(),
  user: vi.fn(),
  verify: vi.fn(),
  revoke: vi.fn(),
  database: vi.fn(),
  origin: vi.fn(),
}))
vi.mock("@/utils/environment", () => ({ appUrl: "https://app.test" }))
vi.mock("@/lib/auth/config", () => ({ assertSameOrigin: fixture.origin }))
vi.mock("@/lib/auth/runtime", () => ({}))
vi.mock("@/lib/auth/transaction", () => ({}))
vi.mock("@/lib/auth/cookies", () => ({
  clearAuthCookies: (response: Response) => {
    response.headers.append(
      "Set-Cookie",
      "gorth.session_app=; Path=/; HttpOnly; Max-Age=0"
    )
    response.headers.append(
      "Set-Cookie",
      "gorth.access_token=; Path=/; HttpOnly; Max-Age=0"
    )
  },
}))
vi.mock("@/services/session", () => ({
  getSessionRecord: fixture.read,
  getUser: fixture.user,
  endSsoSessions: fixture.revoke,
}))
vi.mock("@/services/sso", () => ({
  AuthError,
  verifyLogoutToken: fixture.verify,
}))
vi.mock("@/database", () => ({ getDatabase: fixture.database }))
import { GET, POST, PATCH, HEAD, OPTIONS } from "@/app/(api)/[...route]/route"

function request(
  path: string,
  method = "GET",
  body?: string,
  contentType?: string
) {
  return new Request("https://app.test" + path, {
    method,
    body,
    headers: contentType ? { "Content-Type": contentType } : undefined,
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  fixture.read.mockResolvedValue(null)
  fixture.user.mockResolvedValue(null)
  fixture.database.mockImplementation(() => {
    throw new Error("private-db-detail")
  })
})

describe("Hono Next adapter contracts", () => {
  it("unknown endpoints remain 404", async () => {
    expect((await GET(request("/missing"))).status).toBe(404)
  })
  it("unsupported verbs retain 405 and the precise Allow header", async () => {
    const response = await PATCH(request("/auth/me", "PATCH"))
    expect(response.status).toBe(405)
    expect(response.headers.get("Allow")?.split(", ")).toEqual([
      "DELETE",
      "GET",
      "HEAD",
      "OPTIONS",
    ])
    expect(fixture.read).not.toHaveBeenCalled()
  })
  it("OPTIONS performs no session lookup or mutation", async () => {
    const response = await OPTIONS(request("/auth/sign-out", "OPTIONS"))
    expect(response.status).toBe(204)
    expect(response.headers.get("Allow")).toBe("OPTIONS, POST")
    expect(fixture.origin).not.toHaveBeenCalled()
  })
  it("HEAD retains GET status and headers without returning a body", async () => {
    const response = await HEAD(request("/auth/me", "HEAD"))
    expect(response.status).toBe(401)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(response.headers.getSetCookie()).toHaveLength(2)
    expect(await response.text()).toBe("")
  })
  it("preserves separate Set-Cookie values on ordinary responses", async () => {
    const response = await GET(request("/auth/me"))
    expect(response.headers.getSetCookie()).toHaveLength(2)
    expect(await response.json()).toEqual({ user: null, session: null })
  })
  it("domain routes use explicit session authorization and same-origin mutations", async () => {
    const probe = await GET(request("/sync"))
    const path = probe.status === 404 ? "/skin" : "/sync"
    const anonymous = await GET(request(path))
    expect(anonymous.status).toBe(401)
    expect(fixture.user).toHaveBeenLastCalledWith(false)
    fixture.origin.mockImplementation(() => {
      throw new Error("invalid-origin")
    })
    expect(
      (await POST(request(path, "POST", "{}", "application/json"))).status
    ).toBe(403)
    expect(fixture.database).not.toHaveBeenCalled()
  })
  it("storage failures are private, non-cacheable 503 responses", async () => {
    fixture.user.mockResolvedValue({
      id: "local-user",
      name: "User",
      email: "user@test",
      username: null,
      image: null,
    })
    const probe = await GET(request("/sync"))
    const response = probe.status === 404 ? await GET(request("/skin")) : probe
    expect(response.status).toBe(503)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(await response.text()).not.toContain("private-db-detail")
  })
})

describe("Hono signed SSO backchannel", () => {
  it("rejects an invalid signature instead of applying revocation", async () => {
    fixture.verify.mockRejectedValue(new AuthError("rejected"))
    const response = await POST(
      request(
        "/auth/backchannel-logout",
        "POST",
        "logout_token=fixture",
        "application/x-www-form-urlencoded"
      )
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "invalid_logout_token" })
    expect(fixture.revoke).not.toHaveBeenCalled()
  })
  it("returns 503 when verification infrastructure is temporarily unavailable", async () => {
    fixture.verify.mockRejectedValue(new AuthError("unavailable"))
    const response = await POST(
      request(
        "/auth/backchannel-logout",
        "POST",
        "logout_token=fixture",
        "application/x-www-form-urlencoded"
      )
    )
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: "session_unavailable" })
    expect(fixture.revoke).not.toHaveBeenCalled()
  })
  it("rejects wrong content type before verifying a token", async () => {
    const response = await POST(
      request("/auth/backchannel-logout", "POST", "{}", "application/json")
    )
    expect(response.status).toBe(400)
    expect(fixture.verify).not.toHaveBeenCalled()
  })
  it("rejects duplicate logout tokens", async () => {
    const response = await POST(
      request(
        "/auth/backchannel-logout",
        "POST",
        "logout_token=a&logout_token=b",
        "application/x-www-form-urlencoded"
      )
    )
    expect(response.status).toBe(400)
    expect(fixture.verify).not.toHaveBeenCalled()
  })
  it("bounds the streamed body without Content-Length", async () => {
    const response = await POST(
      request(
        "/auth/backchannel-logout",
        "POST",
        "logout_token=" + "x".repeat(32768),
        "application/x-www-form-urlencoded"
      )
    )
    expect(response.status).toBe(413)
    expect(fixture.verify).not.toHaveBeenCalled()
  })
  it("accepts signed deliveries without browser cookies or Origin", async () => {
    fixture.verify.mockResolvedValue({
      subject: "sso-subject",
      sessionId: "sso-session",
    })
    const response = await POST(
      request(
        "/auth/backchannel-logout",
        "POST",
        "logout_token=fixture",
        "application/x-www-form-urlencoded"
      )
    )
    expect(response.status).toBe(200)
    expect(fixture.revoke).toHaveBeenCalledExactlyOnceWith({
      subject: "sso-subject",
      sessionId: "sso-session",
    })
    expect(fixture.origin).not.toHaveBeenCalled()
  })
  it("requests redelivery if persistence fails after signature verification", async () => {
    fixture.verify.mockResolvedValue({ subject: "sso-subject" })
    fixture.revoke.mockRejectedValue(new Error("private-db-detail"))
    const response = await POST(
      request(
        "/auth/backchannel-logout",
        "POST",
        "logout_token=fixture",
        "application/x-www-form-urlencoded"
      )
    )
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: "session_unavailable" })
  })
})
