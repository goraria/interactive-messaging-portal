import { afterEach, expect, it, vi } from "vitest"

const fixture = vi.hoisted(() => ({ caller: vi.fn() }))
vi.mock("@/utils/caller", () => ({
  caller: fixture.caller,
}))
vi.mock("@/utils/environment", () => ({
  clientUrl: "https://chat.example.test",
}))
import { authClient } from "../../client/lib/auth/browser"
import { login, register } from "../../client/services/auth"

afterEach(() => vi.unstubAllGlobals())

it("reads app status without forcing SSO identity verification", async () => {
  fixture.caller.mockClear()
  fixture.caller.mockResolvedValue({ status: 401, data: { session: null } })
  await authClient.load()
  expect(fixture.caller).toHaveBeenCalledOnce()
  expect(fixture.caller.mock.calls[0]![0]).not.toHaveProperty("params.fresh")
})

it("starts OAuth by navigation without a trailing session read from the leaving page", async () => {
  const assign = vi.fn()
  vi.stubGlobal("window", {
    location: { origin: "https://chat.example.test", assign },
  })
  fixture.caller.mockClear()
  await login("/chat")
  expect(assign).toHaveBeenCalledExactlyOnceWith(
    "https://chat.example.test/auth/start?returnTo=%2Fchat&mode=sign-in"
  )
  expect(fixture.caller).not.toHaveBeenCalled()
  await register("/chat")
  expect(assign).toHaveBeenLastCalledWith(
    "https://chat.example.test/auth/start?returnTo=%2Fchat&mode=sign-up"
  )
})

it("shared auth-client login reports redirecting and never reads the leaving session", async () => {
  const assign = vi.fn()
  vi.stubGlobal("window", {
    location: { origin: "https://chat.example.test", assign },
  })
  fixture.caller.mockClear()
  await authClient.login({ returnTo: "/chat" })
  expect(assign).toHaveBeenCalledExactlyOnceWith(
    "https://chat.example.test/auth/start?returnTo=%2Fchat&mode=sign-in"
  )
  expect(fixture.caller).not.toHaveBeenCalled()
  expect(authClient.getSnapshot()).toMatchObject({
    status: "loading",
    busy: true,
  })
})

it("signs out through the app and navigates locally, ignoring any provider logout URL", async () => {
  const replace = vi.fn()
  vi.stubGlobal("window", {
    location: { origin: "https://chat.example.test", replace },
  })
  fixture.caller.mockResolvedValue({
    status: 200,
    data: {
      user: null,
      logout_url: "https://sso.example.test/auth/oauth2/end-session",
    },
  })
  await authClient.logout()
  expect(fixture.caller).toHaveBeenCalledWith(
    expect.objectContaining({ url: "/auth/me", method: "DELETE" })
  )
  expect(replace).toHaveBeenCalledExactlyOnceWith("https://chat.example.test/")
})
