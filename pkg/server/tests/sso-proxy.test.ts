import { beforeEach, expect, it, vi } from "vitest"

const fixture = vi.hoisted(() => ({
  calls: [] as {
    headers: Record<string, string>
    redirect?: string
    body?: string
  }[],
  status: 200,
  unavailable: false,
  body: '<!doctype html><form action="http://localhost:3000/auth/oauth2/end-session/confirm"></form>',
  contentType: "text/html; charset=utf-8",
}))
vi.mock("@/utils/environment", () => ({
  serverUrl: "http://localhost:8080",
  authSecret: "fixture-private-secret",
}))
vi.mock("@/utils/fetcher", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../single-sign-on/client/utils/fetcher")
    >()
  return {
    ...actual,
    async fetcher(input: {
      headers: Record<string, string>
      redirect?: string
      body?: string
    }) {
      fixture.calls.push(input)
      if (fixture.unavailable) throw new Error("fixture-network-failure")
      return {
        status: fixture.status,
        statusText: "OK",
        data: Buffer.from(fixture.body),
        headers: {
          "content-type": fixture.contentType,
          "cache-control": "no-store",
          "content-security-policy": "default-src 'none'; form-action 'self'",
          "set-cookie": [
            "gorth.session_token_oidc_logout_confirmation=fixture-confirmation; HttpOnly; Path=/auth/oauth2/end-session/confirm; SameSite=Lax",
            "gorth.fixture=fixture; HttpOnly; Path=/auth",
          ],
        },
      }
    },
  }
})
import { handleAuthProxy } from "../../../single-sign-on/client/lib/auth/proxy"

beforeEach(() => {
  fixture.calls = []
  fixture.status = 200
  fixture.unavailable = false
  fixture.contentType = "text/html; charset=utf-8"
  fixture.body =
    '<!doctype html><form action="http://localhost:3000/auth/oauth2/end-session/confirm"></form>'
})

it.each([
  ["gorth-browser-website", 5503],
  ["gorth-launcher-website", 5504],
])(
  "serves logout confirmation for %s using identity bytes and preserves cookies",
  async (client, port) => {
    const url = new URL("/auth/oauth2/end-session", "http://localhost:3000")
    url.searchParams.set("client_id", String(client))
    url.searchParams.set("post_logout_redirect_uri", `http://localhost:${port}`)
    const request = new Request(url, {
      headers: {
        Accept: "text/html",
        "Accept-Encoding": "gzip, deflate, br",
        Cookie: "fixture-cookie",
      },
    })
    const result = await handleAuthProxy(request, {
      params: Promise.resolve({ all: ["oauth2", "end-session"] }),
    })
    expect(result.status).toBe(200)
    expect(await result.text()).toBe(fixture.body)
    const forwarded = new Headers(fixture.calls[0]?.headers)
    expect(forwarded.get("Accept-Encoding")).toBe("identity")
    expect(forwarded.get("Cookie")).toBe("fixture-cookie")
    expect(fixture.calls[0]?.redirect).toBe("manual")
    expect(request.headers.get("Accept-Encoding")).toBe("gzip, deflate, br")
    expect(result.headers.getSetCookie()).toHaveLength(2)
    expect(result.headers.get("Content-Security-Policy")).toContain(
      "form-action 'self'"
    )
    expect(result.headers.get("Cache-Control")).toBe("no-store")
  }
)

it("preserves a provider rejection instead of reporting a connection failure", async () => {
  fixture.status = 400
  fixture.body = "<html>Logout request rejected</html>"
  const result = await handleAuthProxy(
    new Request("http://localhost:3000/auth/oauth2/end-session"),
    {
      params: Promise.resolve({ all: ["oauth2", "end-session"] }),
    }
  )
  expect(result.status).toBe(400)
  expect(await result.text()).toBe(fixture.body)
})

it("returns unavailable on a genuine upstream transport failure", async () => {
  fixture.unavailable = true
  const result = await handleAuthProxy(
    new Request("http://localhost:3000/auth/oauth2/end-session"),
    {
      params: Promise.resolve({ all: ["oauth2", "end-session"] }),
    }
  )
  expect(result.status).toBe(503)
  expect((await result.json()).error).toBe("sso_server_unavailable")
})

it("converts the provider's confirmed logout JSON into a redirect without losing cookies", async () => {
  fixture.contentType = "application/json"
  fixture.body = JSON.stringify({
    redirect: true,
    url: "http://localhost:5503",
  })
  const result = await handleAuthProxy(
    new Request("http://localhost:3000/auth/oauth2/end-session/confirm", {
      method: "POST",
      body: "action=confirm",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }),
    { params: Promise.resolve({ all: ["oauth2", "end-session", "confirm"] }) }
  )
  expect(result.status).toBe(302)
  expect(result.headers.get("Location")).toBe("http://localhost:5503/")
  expect(result.headers.getSetCookie()).toHaveLength(2)
})
