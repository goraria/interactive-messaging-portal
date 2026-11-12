import { describe, expect, it, vi } from "vitest"
import {
  generateKeyPair,
  exportJWK,
  createLocalJWKSet,
  SignJWT,
} from "@gorth/structure/cores/jose"
import {
  createSessionBoundTransport,
  type AuthTransport,
} from "@gorth/structure/modules/auth/server"

describe("interactive session policy vs detached offline access", () => {
  it("requires a signed sid and revokes a detached refresh grant instead of resurrecting login", async () => {
    const keys = await generateKeyPair("RS256")
    const key = createLocalJWKSet({
      keys: [
        { ...(await exportJWK(keys.publicKey)), kid: "fixture", alg: "RS256" },
      ],
    })
    const issuer = "https://sso.example.test/auth",
      clientId = "chat"
    const tokenUrl = issuer + "/token",
      revocationUrl = issuer + "/revoke"
    const issue = (sid?: string) =>
      new SignJWT(sid ? { sid } : {})
        .setProtectedHeader({ alg: "RS256", kid: "fixture" })
        .setIssuer(issuer)
        .setAudience(clientId)
        .setSubject("stable-sso-sub")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(keys.privateKey)
    let id = await issue("active-sid")
    const request = vi.fn<AuthTransport["request"]>(async (url) => ({
      status: 200,
      data:
        url === tokenUrl
          ? { id_token: id, refresh_token: "fixture-refresh" }
          : {},
    }))
    const transport = createSessionBoundTransport(
      { request },
      {
        issuer,
        clientId,
        tokenUrl,
        revocationUrl,
        endpointOrigins: [new URL(issuer).origin],
        key: () => key,
      }
    )
    const input = {
      method: "POST" as const,
      headers: {},
      body: new URLSearchParams({ grant_type: "refresh_token" }),
    }
    expect((await transport.request(tokenUrl, input)).status).toBe(200)
    id = await issue() // Offline access survives SSO session deletion, but interactive login must not.
    await expect(transport.request(tokenUrl, input)).rejects.toMatchObject({
      code: "rejected",
    })
    expect(request.mock.calls.at(-1)?.[0]).toBe(revocationUrl)
    expect(request.mock.calls.at(-1)?.[1].body?.get("token_type_hint")).toBe(
      "refresh_token"
    )
    id = "untrusted.invalid.jwt"
    await expect(transport.request(tokenUrl, input)).rejects.toMatchObject({
      code: "rejected",
    })
  })
})
