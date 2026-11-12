import { beforeEach, expect, it, vi } from "vitest"
import { AuthError } from "@gorth-io/structure/modules/auth/server"
const fixture = vi.hoisted(() => ({ identity: vi.fn(), credentials: vi.fn() }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/services/session", () => ({
  readAppIdentity: fixture.identity,
  readAppCredentials: fixture.credentials,
}))
import { readSession } from "@/lib/auth/dal"
beforeEach(() => {
  fixture.identity.mockReset()
  fixture.credentials.mockReset()
})
it("reads native local identity without a self-fetch, exposes SSO sub and no OAuth tokens", async () => {
  fixture.identity.mockResolvedValue({
    subject: "sso-sub",
    expiresAt: 123,
    user: {
      id: "local-id",
      name: "User",
      email: "user@example.test",
      username: null,
      image: null,
      syncedAt: new Date(),
    },
  })
  expect(await readSession()).toEqual({
    user: {
      id: "sso-sub",
      name: "User",
      email: "user@example.test",
      username: null,
      image: null,
    },
    expiresAt: 123,
  })
  expect(fixture.credentials).not.toHaveBeenCalled()
})
it("distinguishes signed-out from unavailable native session storage", async () => {
  fixture.identity.mockResolvedValue(null)
  expect(await readSession()).toBeNull()
  fixture.identity.mockRejectedValue(new AuthError("unavailable"))
  await expect(readSession()).rejects.toMatchObject({ code: "unavailable" })
})
