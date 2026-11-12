import { expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const fixture = vi.hoisted(() => ({
  finish: vi.fn(async () => { throw new Error("expired_or_cancelled") }),
  create: vi.fn(),
  clear: vi.fn(),
}))
vi.mock("@/utils/environment", () => ({ appUrl: "https://app.test" }))
vi.mock("@/lib/auth/cookies", () => ({}))
vi.mock("@/lib/auth/runtime", () => ({
  getAuthRuntime: () => ({ provider: { finishLogin: fixture.finish } }),
}))
vi.mock("@/lib/auth/config", () => ({ getAuthConfig: () => ({ origin: "https://app.test" }) }))
vi.mock("@/lib/auth/transaction", () => ({
  readTransaction: vi.fn(async () => null),
  clearTransaction: fixture.clear,
}))
vi.mock("@/services/session", () => ({ createSession: fixture.create }))
import { GET } from "@/app/(api)/[...route]/route"

it("a timed-out login returns home and clears only pending state, not an existing app session", async () => {
  const response = await GET(new NextRequest(
    "https://app.test/auth/exchange?error=access_denied&state=expired-fixture"
  ))
  expect(response.headers.get("location")).toBe("https://app.test/?auth=cancelled")
  expect(fixture.clear).toHaveBeenCalledExactlyOnceWith(response)
  expect(fixture.create).not.toHaveBeenCalled()
  expect(response.headers.get("cache-control")).toBe("no-store")
})
