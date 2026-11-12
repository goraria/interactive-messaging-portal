import { afterEach, beforeEach, expect, it, vi } from "vitest"

const fixture = vi.hoisted(() => ({
  caller: vi.fn(),
  replace: vi.fn(),
  assign: vi.fn(),
}))
vi.mock("@/utils/caller", () => ({
  caller: fixture.caller,
}))
import { authClient } from "@/lib/auth/browser"

beforeEach(() => {
  fixture.caller.mockReset()
  fixture.replace.mockReset()
  fixture.assign.mockReset()
  vi.stubGlobal("window", {
    location: {
      origin: "https://website.example.test",
      replace: fixture.replace,
      assign: fixture.assign,
    },
  })
})
afterEach(() => vi.unstubAllGlobals())

it("reads app status without forcing SSO identity verification", async () => {
  fixture.caller.mockResolvedValue({ status: 401, data: { session: null } })
  await authClient.load()
  expect(fixture.caller).toHaveBeenCalledOnce()
  expect(fixture.caller.mock.calls[0]![0]).not.toHaveProperty("params.fresh")
})

it("logs out using the app endpoint and reloads only the app home page", async () => {
  fixture.caller.mockResolvedValue({ status: 200, data: { user: null } })
  await authClient.logout()
  expect(fixture.caller).toHaveBeenCalledWith(
    expect.objectContaining({
      url: "/auth/me",
      method: "DELETE",
      baseURL: null,
      withCredentials: true,
    })
  )
  expect(fixture.replace).toHaveBeenCalledExactlyOnceWith("/")
  expect(authClient.getSnapshot().status).toBe("anonymous")
})

it("does not follow a legacy or injected SSO logout URL", async () => {
  fixture.caller.mockResolvedValue({
    status: 200,
    data: {
      user: null,
      logout_url: "https://sso.example.test/auth/oauth2/end-session",
    },
  })
  await authClient.logout()
  expect(fixture.replace).toHaveBeenCalledExactlyOnceWith("/")
})

it("does not acknowledge failed app-session deletion by navigating away", async () => {
  fixture.caller.mockResolvedValue({
    status: 503,
    data: { error: "session_unavailable" },
  })
  await expect(authClient.logout()).rejects.toMatchObject({
    code: "unavailable",
  })
  expect(fixture.replace).not.toHaveBeenCalled()
})

it("keeps login redirecting without reading an old app session", async () => {
  fixture.caller.mockResolvedValue({ status: 401, data: { session: null } })
  await authClient.login({ returnTo: "/account" })
  expect(fixture.assign).toHaveBeenCalledExactlyOnceWith(
    "https://website.example.test/auth/start?returnTo=%2Faccount&mode=sign-in"
  )
  expect(fixture.caller).not.toHaveBeenCalled()
  expect(authClient.getSnapshot()).toMatchObject({
    status: "loading",
    busy: true,
  })
})
