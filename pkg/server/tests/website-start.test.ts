import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import {
  createAuthPolicy,
  createOAuthProvider,
  type LoginTransaction,
} from "@gorth/structure/modules/auth/server"

const fixture = vi.hoisted(() => ({
  startLogin: vi.fn(),
  setTransaction: vi.fn(),
}))

vi.mock("@/utils/environment", () => ({
  appUrl: "https://website.example.test",
}))
vi.mock("@/lib/auth/cookies", () => ({}))
vi.mock("@/lib/auth/config", () => ({
  getAuthConfig: () => ({ origin: "https://website.example.test" }),
}))
vi.mock("@/lib/auth/runtime", () => ({
  getAuthRuntime: () => ({ provider: { startLogin: fixture.startLogin } }),
}))
vi.mock("@/lib/auth/transaction", () => ({
  setTransaction: fixture.setTransaction,
}))

import { GET } from "@/app/(api)/[...route]/route"

beforeEach(() => {
  const provider = createOAuthProvider({
    config: {
      issuer: "https://sso.example.test/auth",
      clientId: "fixture-website",
      redirectUri: "https://website.example.test/auth/exchange",
      scopes: ["openid", "profile", "email"],
      endpointOrigins: ["https://sso.example.test"],
      endpoints: {
        authorization: "https://sso.example.test/auth/oauth2/authorize",
        token: "https://sso.example.test/auth/oauth2/token",
        userinfo: "https://sso.example.test/auth/oauth2/userinfo",
        revocation: "https://sso.example.test/auth/oauth2/revoke",
      },
    },
    transport: {
      request: async () => {
        throw new Error("No upstream calls expected")
      },
    },
    getVerificationKey: async () => {
      throw new Error("No token verification expected")
    },
    loginStorage: { reserve: async () => true, consume: async () => true },
    policy: createAuthPolicy({ transactionMaxAgeMs: 120_000 }),
  })
  fixture.startLogin.mockReset().mockImplementation(provider.startLogin)
  fixture.setTransaction.mockReset().mockResolvedValue(undefined)
})

describe("reference website account selection", () => {
  it.each([undefined, "sign-in", "unknown"])(
    "requests account selection for login mode %s, independent of the existing SSO session",
    async (mode) => {
      const url = new URL(
        "https://website.example.test/auth/start?returnTo=%2Faccount"
      )
      if (mode !== undefined) url.searchParams.set("mode", mode)
      const response = await GET(new NextRequest(url))
      expect(response.status).toBe(307)
      const authorization = new URL(response.headers.get("Location")!)
      expect(authorization.pathname).toBe("/auth/oauth2/authorize")
      expect(authorization.searchParams.get("prompt")).toBe("select_account")
      expect(authorization.searchParams.get("response_type")).toBe("code")
      expect(authorization.searchParams.get("code_challenge_method")).toBe(
        "S256"
      )
      expect(authorization.searchParams.get("code_challenge")).toHaveLength(43)
      const transaction = fixture.setTransaction.mock
        .calls[0]![1] as LoginTransaction
      expect(transaction.returnTo).toBe("/account")
      expect(authorization.searchParams.get("state")).toBe(transaction.state)
      expect(authorization.searchParams.get("nonce")).toBe(transaction.nonce)
      expect(authorization.searchParams.has("code_verifier")).toBe(false)
      expect(response.headers.get("Cache-Control")).toBe("no-store")
      expect(response.headers.get("Referrer-Policy")).toBe("no-referrer")
    }
  )

  it.each(["sign-up", "register"])(
    "preserves registration for %s",
    async (mode) => {
      const response = await GET(
        new NextRequest(`https://website.example.test/auth/start?mode=${mode}`)
      )
      expect(
        new URL(response.headers.get("Location")!).searchParams.get("prompt")
      ).toBe("create")
    }
  )

  it("does not let an incoming query parameter bypass account selection", async () => {
    const response = await GET(
      new NextRequest("https://website.example.test/auth/start?prompt=none")
    )
    expect(
      new URL(response.headers.get("Location")!).searchParams.get("prompt")
    ).toBe("select_account")
  })

  it("rejects foreign app origins before creating a login transaction", async () => {
    const response = await GET(
      new NextRequest("https://foreign.example.test/auth/start")
    )
    expect(response.status).toBe(400)
    expect(fixture.startLogin).not.toHaveBeenCalled()
    expect(fixture.setTransaction).not.toHaveBeenCalled()
  })
})
