import { beforeEach, expect, it, vi } from "vitest"
import { APIError } from "better-auth"
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "@gorth-io/structure/cores/jose"

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAccessToken: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  revoked: vi.fn(),
  userinfo: vi.fn(),
  verify: vi.fn(),
}))
vi.mock("@/lib/auth/config", () => ({
  getAuthConfig: () => ({
    origin: "http://localhost:3030",
    clientId: "chat",
    ssoOrigin: "http://localhost:3000",
    issuer: "http://localhost:3000/auth",
  }),
}))
vi.mock("@/utils/environment", () => ({
  oauthCookiePrefix: "gorth",
  oauthAudience: "http://localhost:3030",
}))
vi.mock("@/lib/auth/server", () => ({
  getAuth: () => ({
    api: { getSession: mocks.getSession, getAccessToken: mocks.getAccessToken },
  }),
}))
vi.mock("@/database", () => ({
  getDatabase: () => ({ select: mocks.select, update: mocks.update }),
}))
vi.mock("@/services/revocation", () => ({ isSsoSessionRevoked: mocks.revoked }))
vi.mock("@/services/sso-userinfo", () => ({ getSsoUserInfo: mocks.userinfo }))
vi.mock("better-auth/oauth2", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth/oauth2")>()),
  verifyAccessTokenRequest: mocks.verify,
}))

import { readAppCredentials } from "@/services/session"

const incoming = new Headers({
  Cookie: "gorth.session_token=opaque.native.signature",
})
const createdAt = new Date()
function rows(value: object[]) {
  return { from: () => ({ where: () => ({ limit: async () => value }) }) }
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getSession.mockResolvedValue({
    user: { id: "local-id" },
    session: {
      id: "native-id",
      ssoSessionId: "central-sid",
      createdAt,
      expiresAt: new Date(Date.now() + 60_000),
    },
  })
  mocks.select
    .mockReturnValueOnce(
      rows([
        {
          id: "local-id",
          externalUserId: "central-sub",
          status: "active",
          bannedAt: null,
          deletedAt: null,
          syncedAt: new Date(),
        },
      ])
    )
    .mockReturnValueOnce(rows([{ id: "account-id" }]))
    .mockReturnValueOnce(rows([{ id: "native-id" }]))
  mocks.getAccessToken.mockResolvedValue({
    accessToken: "server-only-access-token",
  })
  mocks.verify.mockResolvedValue({
    sub: "central-sub",
    sid: "central-sid",
  })
  mocks.revoked.mockResolvedValue(false)
  mocks.userinfo.mockResolvedValue({ sub: "central-sub", status: "active" })
  mocks.update.mockReturnValue({
    set: () => ({ where: async () => undefined }),
  })
})

it("rejects anonymous requests without DB or provider calls", async () => {
  expect(await readAppCredentials(new Headers())).toBeNull()
  expect(mocks.getSession).not.toHaveBeenCalled()
  expect(mocks.getAccessToken).not.toHaveBeenCalled()
})
it("reads native sessions directly and keeps routine reads offline within freshness", async () => {
  const session = await readAppCredentials(incoming)
  expect(session?.subject).toBe("central-sub")
  expect(mocks.getSession).toHaveBeenCalledWith({
    headers: incoming,
    query: { disableCookieCache: true },
  })
  expect(mocks.getAccessToken).toHaveBeenCalledWith({
    headers: incoming,
    body: { accountId: "account-id" },
  })
  expect(mocks.userinfo).not.toHaveBeenCalled()
  expect(mocks.verify).toHaveBeenCalledWith(
    expect.objectContaining({
      authorizationHeader: "Bearer server-only-access-token",
    }),
    expect.objectContaining({
      jwksUrl: "http://localhost:3000/auth/jwks",
      verifyOptions: expect.objectContaining({
        issuer: "http://localhost:3000/auth",
        audience: "http://localhost:3030",
        typ: "at+jwt",
      }),
    })
  )
})
it("cannot substitute another subject or SID from the refreshed provider account", async () => {
  mocks.verify.mockResolvedValue({
    sub: "another-user",
    sid: "central-sid",
  })
  await expect(readAppCredentials(incoming)).rejects.toMatchObject({
    code: "rejected",
  })
  mocks.select.mockReset()
  mocks.select
    .mockReturnValueOnce(
      rows([
        {
          id: "local-id",
          externalUserId: "central-sub",
          status: "active",
          syncedAt: new Date(),
        },
      ])
    )
    .mockReturnValueOnce(rows([{ id: "account-id" }]))
  mocks.verify.mockResolvedValue({
    sub: "central-sub",
    sid: "other-sid",
  })
  await expect(readAppCredentials(incoming)).rejects.toMatchObject({
    code: "rejected",
  })
})
it("rejects durable revocation before requesting account tokens", async () => {
  mocks.revoked.mockResolvedValue(true)
  expect(await readAppCredentials(incoming)).toBeNull()
  expect(mocks.getAccessToken).not.toHaveBeenCalled()
})
it("checks SSO directly for sensitive actions and fences a raced logout", async () => {
  mocks.select.mockReset()
  mocks.select
    .mockReturnValueOnce(
      rows([
        {
          id: "local-id",
          externalUserId: "central-sub",
          status: "active",
          syncedAt: new Date(),
        },
      ])
    )
    .mockReturnValueOnce(rows([{ id: "account-id" }]))
    .mockReturnValueOnce(rows([]))
  expect(await readAppCredentials(incoming, true)).toBeNull()
  expect(mocks.userinfo).toHaveBeenCalledWith("server-only-access-token", {
    fresh: true,
  })
})
it("does not discard the app session when a live SSO check is unavailable", async () => {
  mocks.userinfo.mockRejectedValue(new Error("provider unavailable"))
  await expect(readAppCredentials(incoming, true)).rejects.toThrow(
    "provider unavailable"
  )
  expect(mocks.update).not.toHaveBeenCalled()
})
it("verifies a real signed access token and JWKS before a stale identity check", async () => {
  const pair = await generateKeyPair("EdDSA")
  const kid = "native-credentials-jwks"
  const jwk = { ...(await exportJWK(pair.publicKey)), kid, alg: "EdDSA" }
  const token = await new SignJWT({
    sid: "central-sid",
    scope: "chat:read chat:write",
  })
    .setProtectedHeader({ alg: "EdDSA", kid, typ: "at+jwt" })
    .setIssuer("http://localhost:3000/auth")
    .setAudience([
      "http://localhost:3030",
      "http://localhost:3000/auth/oauth2/userinfo",
    ])
    .setSubject("central-sub")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(pair.privateKey)
  const native =
    await vi.importActual<typeof import("better-auth/oauth2")>(
      "better-auth/oauth2"
    )
  mocks.verify.mockImplementationOnce(native.verifyAccessTokenRequest)
  mocks.getAccessToken.mockResolvedValueOnce({ accessToken: token })
  const network = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json({ keys: [jwk] }))
  expect((await readAppCredentials(incoming, true))?.subject).toBe(
    "central-sub"
  )
  expect(String(network.mock.calls[0]?.[0])).toBe("http://localhost:3000/auth/jwks")
  expect(mocks.userinfo).toHaveBeenCalledWith(token, { fresh: true })
  expect(mocks.update).toHaveBeenCalledOnce()
})
it("identifies a failed provider-token operation without logging credentials", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {})
  mocks.getAccessToken.mockRejectedValueOnce(
    new APIError("BAD_REQUEST", {
      code: "PROVIDER_NOT_SUPPORTED",
      message: "private-provider-details",
    })
  )
  await expect(readAppCredentials(incoming, true)).rejects.toThrow()
  expect(log).toHaveBeenCalledWith(
    "[auth/session]",
    expect.objectContaining({
      stage: "provider-token",
      code: "PROVIDER_NOT_SUPPORTED",
      status: 400,
    })
  )
  expect(JSON.stringify(log.mock.calls)).not.toContain(
    "private-provider-details"
  )
  expect(mocks.userinfo).not.toHaveBeenCalled()
})
