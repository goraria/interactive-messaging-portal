import { afterEach, beforeEach, expect, it, vi } from "vitest"
import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
} from "@gorth/structure/cores/axios"
const fixture = vi.hoisted(() => ({ refresh: vi.fn(), notice: vi.fn() }))
vi.mock("@/lib/auth/browser", () => ({ authClient: { load: fixture.refresh } }))
vi.mock("@gorth/primitive/custom/toast", () => ({
  toast: { add: fixture.notice },
}))
import { caller, CallerError } from "@/utils/caller"
import { resetCallerAuthentication } from "@/lib/auth/client"
import { toWebResponse } from "@/utils/fetcher"

beforeEach(() => {
  resetCallerAuthentication()
  fixture.refresh.mockReset()
  fixture.notice.mockClear()
})
afterEach(() => vi.unstubAllGlobals())
async function failure(operation: Promise<unknown>): Promise<CallerError> {
  try {
    await operation
  } catch (error) {
    if (!(error instanceof CallerError)) throw error
    return error
  }
  throw new Error("Expected a failed request")
}
function protectedAdapter(
  ready: () => boolean,
  attempts: () => void
): AxiosAdapter {
  return async (config) => {
    attempts()
    const response = {
      config,
      data: { data: "ok" },
      headers: new AxiosHeaders(),
      status: ready() ? 200 : 401,
      statusText: "fixture",
    }
    if (response.status === 401)
      throw new AxiosError(
        "Fixture unauthorized",
        "ERR_BAD_REQUEST",
        config,
        undefined,
        response
      )
    return response
  }
}
it("coordinates overlapping protected reads with one shared refresh", async () => {
  let ready = false,
    attempts = 0
  fixture.refresh.mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    ready = true
    return true
  })
  const adapter = protectedAdapter(
    () => ready,
    () => attempts++
  )
  expect(
    await Promise.all([
      caller({ url: "/user", adapter }),
      caller({ url: "/resource", adapter }),
    ])
  ).toEqual(["ok", "ok"])
  expect(fixture.refresh).toHaveBeenCalledTimes(1)
  expect(attempts).toBe(4)
})
it("supports opting out of mutation authentication retries", async () => {
  const error = await failure(
    caller({
      url: "/resource",
      method: "POST",
      auth: false,
      body: { name: "fixture" },
      adapter: protectedAdapter(
        () => false,
        () => {}
      ),
    })
  )
  expect(error.status).toBe(401)
  expect(error.message).toBe("Fixture unauthorized")
  expect(fixture.refresh).not.toHaveBeenCalled()
})
it("restores legacy mutation retry after a successful authentication refresh", async () => {
  let ready = false,
    attempts = 0
  fixture.refresh.mockImplementation(async () => {
    ready = true
    return true
  })
  expect(
    await caller({
      url: "/resource",
      method: "POST",
      adapter: protectedAdapter(
        () => ready,
        () => attempts++
      ),
    })
  ).toBe("ok")
  expect(attempts).toBe(2)
})
it("never refreshes recursively for auth endpoints", async () => {
  await expect(
    caller({
      url: "/auth/me",
      adapter: protectedAdapter(
        () => false,
        () => {}
      ),
    })
  ).rejects.toMatchObject({ status: 401 })
  expect(fixture.refresh).not.toHaveBeenCalled()
})
it("logout reset fences a refresh result and prevents replay", async () => {
  let release!: (value: boolean) => void,
    attempts = 0
  fixture.refresh.mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        release = resolve
      })
  )
  const pending = failure(
    caller({
      url: "/user",
      adapter: protectedAdapter(
        () => false,
        () => attempts++
      ),
    })
  )
  await vi.waitFor(() => expect(fixture.refresh).toHaveBeenCalledTimes(1))
  resetCallerAuthentication()
  release(true)
  expect((await pending).status).toBe(401)
  expect(attempts).toBe(1)
})
it("preserves request cancellation without canceling another refresh waiter", async () => {
  let release!: (value: boolean) => void,
    ready = false
  fixture.refresh.mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        release = resolve
      })
  )
  const controller = new AbortController()
  const adapter = protectedAdapter(
    () => ready,
    () => {}
  )
  const first = failure(
    caller({ url: "/user", adapter, signal: controller.signal })
  )
  const second = caller({ url: "/resource", adapter })
  await vi.waitFor(() => expect(fixture.refresh).toHaveBeenCalledTimes(1))
  controller.abort()
  ready = true
  release(true)
  expect((await first).code).toBe("ERR_CANCELED")
  expect(await second).toBe("ok")
})
it("canonical Response adapter preserves binary views and separate cookies", async () => {
  const response = toWebResponse({
    data: new Uint8Array([0, 1, 2, 3]).subarray(1, 3),
    status: 200,
    statusText: "OK",
    headers: {
      "set-cookie": ["one=fixture; HttpOnly", "two=fixture; HttpOnly"],
    },
    config: { headers: new AxiosHeaders() },
  })
  expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([
    1, 2,
  ])
  expect(response.headers.getSetCookie()).toHaveLength(2)
})

it("defaults to same-origin and uses only an explicitly supplied baseURL", async () => {
  const seen: (string | undefined)[] = []
  for (const baseURL of [undefined, null, "https://upstream.example.test"]) {
    await caller({
      url: "/resource",
      baseURL,
      auth: false,
      adapter: async (config) => {
        seen.push(config.baseURL)
        return {
          config,
          data: "ok",
          status: 200,
          statusText: "OK",
          headers: new AxiosHeaders(),
        }
      },
    })
  }
  expect(seen).toEqual([undefined, undefined, "https://upstream.example.test"])
})
it.each([204, 205, 304])(
  "converts status %s to a response with no body",
  async (status) => {
    const response = toWebResponse({
      data: "An upstream adapter may leave data here",
      status,
      statusText: "fixture",
      headers: {},
      config: { headers: new AxiosHeaders() },
    })
    expect(response.status).toBe(status)
    expect(response.body).toBeNull()
    expect(await response.text()).toBe("")
  }
)
