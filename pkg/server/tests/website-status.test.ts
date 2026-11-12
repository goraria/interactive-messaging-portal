import { beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const fixture = vi.hoisted(() => ({
  read: vi.fn(),
  sync: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
  cookies: vi.fn(),
  legacy: vi.fn(),
  transaction: vi.fn(),
}))
vi.mock("@/services/session", () => ({
  getSessionRecord: fixture.read,
  syncSessionCookies: fixture.sync,
  removeSession: fixture.remove,
}))
vi.mock("@/lib/auth/config", () => ({ assertSameOrigin: vi.fn() }))
vi.mock("@/lib/auth/cookies", () => ({
  clearAuthCookies: fixture.clear,
  clearLegacyAuthCookies: fixture.legacy,
  setAuthTokenCookies: fixture.cookies,
}))
vi.mock("@/lib/auth/transaction", () => ({
  clearTransaction: fixture.transaction,
}))
import { GET } from "@/app/(api)/[...route]/route"
beforeEach(() => vi.clearAllMocks())

it("reads status and rotated cookies from one verified record, without exposing credentials", async () => {
  const record = {
    user: {
      id: "local-user",
      name: "Updated",
      email: "user@example.test",
      username: null,
      image: null,
      role: "admin",
    },
    subject: "sso-subject",
    expiresAt: Date.now() + 120000,
    credentials: {
      accessToken: "fixture-access",
      refreshToken: "fixture-refresh",
    },
  }
  fixture.read.mockResolvedValue(record)
  const response = await GET(
    new NextRequest("https://app.test/auth/me?fresh=1")
  )
  expect(response.status).toBe(200)
  expect(fixture.read).toHaveBeenCalledExactlyOnceWith(true)
  expect(fixture.sync).not.toHaveBeenCalled()
  expect(fixture.cookies).toHaveBeenCalledExactlyOnceWith(
    response,
    record.credentials,
    new Date(record.expiresAt)
  )
  const data = await response.json()
  expect(data.user.name).toBe("Updated")
  expect(JSON.stringify(data)).not.toContain("fixture-access")
  expect(data.user).not.toHaveProperty("role")
  expect(data.session).not.toHaveProperty("credentials")
})

it("clears app cookies immediately when the verified session is no longer valid", async () => {
  fixture.read.mockResolvedValue(null)
  const response = await GET(new NextRequest("https://app.test/auth/me"))
  expect(response.status).toBe(401)
  expect(fixture.clear).toHaveBeenCalledExactlyOnceWith(response)
  expect(fixture.cookies).not.toHaveBeenCalled()
})

it("uses the bounded server identity policy for ordinary status reads", async () => {
  fixture.read.mockResolvedValue(null)
  await GET(new NextRequest("https://app.test/auth/me"))
  expect(fixture.read).toHaveBeenCalledExactlyOnceWith(false)
})
