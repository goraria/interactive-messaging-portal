import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import packageInfo from "@/package.json"

const fixture = vi.hoisted(() => ({
  user: vi.fn(),
  origin: vi.fn(),
  list: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  get: vi.fn(),
  activate: vi.fn(),
  normalize: vi.fn(),
}))
vi.mock("@/utils/environment", () => ({ appUrl: "https://app.test" }))
vi.mock("@/lib/auth/config", () => ({ assertSameOrigin: fixture.origin }))
vi.mock("@/lib/auth/runtime", () => ({}))
vi.mock("@/lib/auth/transaction", () => ({}))
vi.mock("@/lib/auth/cookies", () => ({}))
vi.mock("@/services/session", () => ({ getUser: fixture.user }))

const browser = packageInfo.name === "@gorth/browser-website"
const domain = browser ? "/sync" : "/skin"
const id = "123e4567-e89b-42d3-a456-426614174000"
let handlers: typeof import("@/app/(api)/[...route]/route")

beforeAll(async () => {
  const store = browser ? "@/services/sync-store" : "@/services/skin-store"
  vi.doMock(store, () =>
    browser
      ? {
          listSnapshots: fixture.list,
          saveSnapshot: fixture.save,
          deleteSnapshot: fixture.remove,
          getSnapshot: fixture.get,
        }
      : {
          listSkins: fixture.list,
          saveSkin: fixture.save,
          deleteSkin: fixture.remove,
          getSkin: fixture.get,
          activateSkin: fixture.activate,
        }
  )
  if (!browser)
    vi.doMock("@/lib/skin/png", () => ({ normalizeSkin: fixture.normalize }))
  handlers = await import("@/app/(api)/[...route]/route")
})

beforeEach(() => {
  vi.resetAllMocks()
  fixture.user.mockResolvedValue({
    id: "local-user",
    name: "User",
    email: "user@test",
    username: null,
    image: null,
  })
  fixture.list.mockResolvedValue([{ id, isActive: true }])
  fixture.save.mockResolvedValue({ id })
  fixture.normalize.mockReturnValue({ pngBase64: "cG5n", checksum: "fixture" })
})

function request(
  path: string,
  method = "GET",
  body?: BodyInit,
  headers?: HeadersInit
) {
  return new Request("https://app.test" + path, { method, body, headers })
}

describe("Hono private domain endpoints", () => {
  it("lists only the authenticated local user's records", async () => {
    const response = await handlers.GET(request(domain))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ items: [{ id, isActive: true }] })
    expect(fixture.list).toHaveBeenCalledExactlyOnceWith("local-user")
    expect(fixture.user).toHaveBeenCalledExactlyOnceWith(false)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })
  it("creates a record after checking the mutation origin and fresh identity", async () => {
    let body: BodyInit
    let headers: HeadersInit | undefined
    if (browser) {
      body = JSON.stringify({
        name: "Backup",
        deviceName: "Desktop",
        version: 1,
        data: { tabs: [] },
        userId: "attacker",
      })
      headers = { "Content-Type": "application/json" }
    } else {
      const form = new FormData()
      form.set("name", "Skin")
      form.set("model", "classic")
      form.set("file", new File(["png"], "skin.png", { type: "image/png" }))
      form.set("userId", "attacker")
      body = form
    }
    const response = await handlers.POST(request(domain, "POST", body, headers))
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual(
      browser ? { snapshot: { id } } : { skin: { id } }
    )
    expect(fixture.origin).toHaveBeenCalledTimes(1)
    expect(fixture.user).toHaveBeenCalledExactlyOnceWith(true)
    expect(fixture.save).toHaveBeenCalledTimes(1)
    expect(fixture.save.mock.calls[0]![0]).toBe("local-user")
    expect(fixture.save.mock.calls[0]![1]).not.toHaveProperty("userId")
  })
  it("rejects malformed input without creating a record", async () => {
    const response = await handlers.POST(
      request(domain, "POST", "{}", { "Content-Type": "application/json" })
    )
    expect(response.status).toBe(browser ? 400 : 415)
    expect(fixture.save).not.toHaveBeenCalled()
  })
  it("enforces the original streamed upload/body size limit", async () => {
    const maximum = browser ? 2 * 1024 * 1024 : 300 * 1024
    const response = await handlers.POST(
      request(domain, "POST", "x".repeat(maximum + 1), {
        "Content-Type": browser
          ? "application/json"
          : "multipart/form-data; boundary=fixture",
      })
    )
    expect(response.status).toBe(413)
    expect(fixture.save).not.toHaveBeenCalled()
  })
  it("deletes a record with an empty 204 response", async () => {
    const response = await handlers.DELETE(
      request(domain + "?id=" + id, "DELETE")
    )
    expect(response.status).toBe(204)
    expect(await response.text()).toBe("")
    expect(fixture.remove).toHaveBeenCalledExactlyOnceWith("local-user", id)
    expect(fixture.user).toHaveBeenCalledExactlyOnceWith(true)
  })
  it("rejects invalid record identifiers before reaching storage", async () => {
    const response = await handlers.DELETE(
      request(domain + "?id=invalid", "DELETE")
    )
    expect(response.status).toBe(400)
    expect(fixture.remove).not.toHaveBeenCalled()
  })
  it("preserves private attachment data and download headers", async () => {
    fixture.get.mockResolvedValue(
      browser ? { version: 1, data: { tabs: [] } } : { id, pngBase64: "cG5n" }
    )
    const response = await handlers.GET(request(domain + "/file?id=" + id))
    expect(response.status).toBe(200)
    expect(fixture.get).toHaveBeenCalledExactlyOnceWith("local-user", id)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="gorth-' +
        (browser ? "browser-" : "skin-") +
        id +
        (browser ? '.json"' : '.png"')
    )
    if (browser)
      expect(await response.json()).toEqual({ version: 1, data: { tabs: [] } })
    else {
      expect(response.headers.get("Content-Type")).toBe("image/png")
      expect(response.headers.get("Content-Security-Policy")).toBe(
        "default-src 'none'"
      )
      expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("png")
    }
  })
})

if (!browser)
  describe("Hono skin selection", () => {
    it("returns the active skin", async () => {
      const response = await handlers.GET(request("/skin/active"))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ skin: { id, isActive: true } })
    })
    it("activates only the authenticated user's skin", async () => {
      const response = await handlers.POST(
        request("/skin/active", "POST", JSON.stringify({ id }), {
          "Content-Type": "application/json",
        })
      )
      expect(response.status).toBe(204)
      expect(fixture.activate).toHaveBeenCalledExactlyOnceWith("local-user", id)
      expect(fixture.user).toHaveBeenCalledExactlyOnceWith(true)
    })
    it("preserves inline preview without making the PNG cacheable", async () => {
      fixture.get.mockResolvedValue({ id, pngBase64: "cG5n" })
      const response = await handlers.GET(
        request("/skin/file?id=" + id + "&preview=1")
      )
      expect(response.headers.get("Content-Disposition")).toBe(
        'inline; filename="gorth-skin-' + id + '.png"'
      )
      expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    })
  })
