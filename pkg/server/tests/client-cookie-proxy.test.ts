import { beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const fixture = vi.hoisted(() => ({ forward: vi.fn() }))
vi.mock("@/utils/environment", () => ({
  serverUrl: "https://chat-api.example.test",
  sessionAppCookie: "gorth.session_app",
}))
vi.mock("@/services/route", () => ({ forwardRouteRequest: fixture.forward }))
import { GET, POST } from "../../client/app/(api)/[...path]/route"
beforeEach(() =>
  fixture.forward.mockReset().mockResolvedValue(Response.json({ ok: true }))
)

it("fallback routes forward only the app cookie and preserve Origin, not SSO cookies or bearer conversion", async () => {
  const value = "a".repeat(43)
  const response = await GET(
    new NextRequest("https://chat.example.test/lab/auth?fixture=1", {
      headers: {
        Cookie:
          "gorth.session_app=" +
          value +
          "; sso.session_token=must-not-forward; gorth.access_token=stale",
        Origin: "https://chat.example.test",
      },
    }),
    { params: Promise.resolve({ path: ["lab", "auth"] }) }
  )
  expect(response.status).toBe(200)
  const request = fixture.forward.mock.calls[0]![0]
  expect(request.url.href).toBe(
    "https://chat-api.example.test/lab/auth?fixture=1"
  )
  expect(request.headers.get("cookie")).toBe("gorth.session_app=" + value)
  expect(request.headers.get("authorization")).toBeNull()
  expect(request.headers.get("origin")).toBe("https://chat.example.test")
})

it("does not fabricate Origin on writes and leaves CSRF enforcement to Hono", async () => {
  await POST(
    new NextRequest("https://chat.example.test/auth/sync-user", {
      method: "POST",
      headers: {
        Cookie: "gorth.session_app=" + "a".repeat(43),
        "Content-Type": "application/json",
      },
      body: "{}",
    }),
    { params: Promise.resolve({ path: ["auth", "sync-user"] }) }
  )
  const request = fixture.forward.mock.calls[0]![0]
  expect(request.headers.get("origin")).toBeNull()
  expect(request.headers.get("cookie")).toBeTruthy()
  expect(request.body.byteLength).toBe(2)
})
