import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/utils/environment", () => ({
  clientUrl: "https://chat.example.test",
  sessionAppCookie: "gorth.session_app",
}))
vi.mock("@/utils/constant", () => ({ publicPrefixes: ["/demo", "/lab"] }))
import { proxy } from "../../client/proxy"

const request = (path: string, cookie = "a".repeat(43), headers = {}) =>
  new NextRequest("https://chat.example.test" + path, {
    headers: {
      Accept: "text/html",
      Cookie: "gorth.session_app=" + cookie,
      ...headers,
    },
  })
beforeEach(() => {
  vi.spyOn(globalThis, "fetch")
})
afterEach(() => vi.restoreAllMocks())

it("does not call auth/me or SSO before protected navigation and RSC prefetch", async () => {
  for (const incoming of [
    request("/chat"),
    request("/chat", "a".repeat(43), { rsc: "1" }),
  ]) {
    expect((await proxy(incoming)).headers.get("x-middleware-next")).toBe("1")
  }
  expect(fetch).not.toHaveBeenCalled()
})

it("rejects missing/malformed handles without a network round trip", async () => {
  for (const handle of ["", "invalid"])
    expect(
      (await proxy(request("/chat", handle))).headers.get("location")
    ).toBe("https://chat.example.test/")
  expect(fetch).not.toHaveBeenCalled()
})

it("validates the home redirect once without forcing SSO and preserves session cookies", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response("{}", {
      status: 200,
      headers: { "Set-Cookie": "gorth.access_token=fixture; HttpOnly" },
    })
  )
  const response = await proxy(request("/"))
  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    new URL("https://chat.example.test/auth/me"),
    expect.objectContaining({ cache: "no-store" })
  )
  expect(response.headers.get("location")).toBe(
    "https://chat.example.test/chat"
  )
  expect(response.headers.get("set-cookie")).toContain("HttpOnly")
})

it("does not loop an expired session or silently redirect an unavailable session", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 401 }))
  expect((await proxy(request("/"))).headers.get("location")).toBeNull()
  vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 503 }))
  expect((await proxy(request("/"))).status).toBe(503)
})
