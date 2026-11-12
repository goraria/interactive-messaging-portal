import { beforeEach, expect, it, vi } from "vitest"
const fixture = vi.hoisted(() => ({
  handles: [] as string[],
  fetcher: vi.fn(),
}))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => fixture.handles.map((value) => ({ value })),
  }),
}))
vi.mock("@/utils/environment", () => ({
  clientUrl: "https://chat.example.test",
  serverUrl: "https://chat-api.example.test",
  sessionAppCookie: "gorth.session_app",
  accessTokenCookie: "gorth.access_token",
}))
vi.mock("@/utils/fetcher", () => ({ fetcher: fixture.fetcher }))
import { authorizeProxy, readSession } from "../../client/lib/auth/dal"
const publicSession = () => ({
  user: {
    id: "sso-sub",
    name: "User",
    email: "user@example.test",
    username: null,
    image: null,
  },
  expiresAt: Date.now() + 600_000,
})
beforeEach(() => {
  fixture.handles = []
  fixture.fetcher.mockReset().mockResolvedValue({
    status: 200,
    data: { session: publicSession() },
    headers: {
      "set-cookie": [
        "gorth.access_token=authoritative-token; HttpOnly; Secure; SameSite=Lax; Path=/",
      ],
    },
  })
})
it("does not authorize missing or ambiguous app handles from token cookies", async () => {
  for (const handles of [[], ["a".repeat(43), "b".repeat(43)], ["bad"]]) {
    fixture.handles = handles
    expect(
      (await authorizeProxy(new Request("https://chat.example.test/resource")))
        .response?.status
    ).toBe(401)
  }
  expect(fixture.fetcher).not.toHaveBeenCalled()
})
it("uses public Hono HTTP with only the app cookie and no HMAC/RPC payload", async () => {
  fixture.handles = ["a".repeat(43)]
  const result = await authorizeProxy(
    new Request("https://chat.example.test/resource")
  )
  expect(result.token).toBe("authoritative-token")
  expect(result.cookies).toHaveLength(1)
  const request = fixture.fetcher.mock.calls[0]![0]
  expect(request.url.href).toBe("https://chat-api.example.test/auth/me")
  expect(request.method).toBe("GET")
  expect(request.headers).toEqual({
    Cookie: "gorth.session_app=" + fixture.handles[0],
    Origin: "https://chat.example.test",
  })
  expect(request).not.toHaveProperty("body")
  expect(request.redirect).toBe("error")
  expect(await readSession()).toEqual(
    expect.objectContaining({ user: { ...publicSession().user } })
  )
})
it("blocks cross-site writes before Hono and requests fresh checks for valid writes", async () => {
  fixture.handles = ["a".repeat(43)]
  for (const origin of [undefined, "https://evil.example.test"])
    expect(
      (
        await authorizeProxy(
          new Request("https://chat.example.test/resource", {
            method: "POST",
            headers: origin ? { Origin: origin } : {},
          })
        )
      ).response?.status
    ).toBe(403)
  expect(fixture.fetcher).not.toHaveBeenCalled()
  expect(
    (
      await authorizeProxy(
        new Request("https://chat.example.test/resource", {
          method: "POST",
          headers: { Origin: "https://chat.example.test" },
        })
      )
    ).token
  ).toBe("authoritative-token")
  expect(fixture.fetcher.mock.calls[0]![0].url.search).toBe("?fresh=1")
})
it("propagates session deletion and rejects transport/schema/token failures without stale fallback", async () => {
  fixture.handles = ["a".repeat(43)]
  fixture.fetcher.mockResolvedValue({
    status: 401,
    data: { session: null },
    headers: { "set-cookie": ["gorth.session_app=; Max-Age=0; Path=/"] },
  })
  const result = await authorizeProxy(
    new Request("https://chat.example.test/resource")
  )
  expect(result.response?.status).toBe(401)
  expect(result.response?.headers.getSetCookie()).toEqual([
    "gorth.session_app=; Max-Age=0; Path=/",
  ])
  for (const response of [
    { status: 503, data: {}, headers: {} },
    { status: 200, data: { session: publicSession() }, headers: {} },
    {
      status: 200,
      data: { record: { credentials: { accessToken: "must-not-be-used" } } },
      headers: {},
    },
  ]) {
    fixture.fetcher.mockResolvedValue(response)
    expect(
      (await authorizeProxy(new Request("https://chat.example.test/resource")))
        .response?.status
    ).toBe(503)
  }
})
