import { expect, it, vi } from "vitest"
vi.mock("@/utils/environment", () => ({
  serverUrl: "https://chat-api.example.test",
}))
import config from "../../client/next.config"

it("rewrites auth and vertical Chat HTTP directly to Hono, not shared services or the Chat UI", async () => {
  const rewrites = await config.rewrites!()
  if (Array.isArray(rewrites)) throw new Error("Expected beforeFiles rewrites")
  const routes = rewrites.beforeFiles!
  for (const endpoint of [
    "start",
    "exchange",
    "me",
    "backchannel-logout",
    "session",
  ])
    expect(routes).toContainEqual({
      source: "/auth/" + endpoint,
      destination: "https://chat-api.example.test/auth/" + endpoint,
    })
  expect(routes).toContainEqual({
    source: "/proxy/chat/:path*",
    destination: "https://chat-api.example.test/chat/:path*",
  })
  for (const prefix of ["/resource", "/notification", "/discovery"])
    expect(routes.some((route) => route.source.startsWith(prefix))).toBe(false)
  expect(
    routes.some(
      (route) => route.source === "/chat" || route.source === "/chat/:path*"
    )
  ).toBe(false)
})
