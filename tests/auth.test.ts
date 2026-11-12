import { describe, expect, it, vi } from "vitest"
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "@gorth-io/structure/cores/jose"
import {
  createLogoutVerifier,
  matchesAuthRevocation,
  type VerifiedLogout,
} from "@gorth-io/structure/modules/auth/server"
import {
  isInsufficientScopeError,
  requestToResourceInput,
  verifyAccessTokenRequest,
} from "better-auth/oauth2"

// The retired OAuth/session engines are covered by native Generic OAuth and
// native-session suites now. Keep independent JWT/logout protocol coverage here.
const issuer = "https://sso.example.test/auth"
const clientId = "gorth-interactive-messaging-portal"
const resourceUrl = "https://chat.example.test"
const subject = "sso-subject-not-local-uuid"

async function keys() {
  const pair = await generateKeyPair("RS256")
  const jwk = {
    ...(await exportJWK(pair.publicKey)),
    kid: "native-api-fixture",
    alg: "RS256",
  }
  return { pair, jwk }
}

describe("app-owned Better Auth and shared logout helpers", () => {
  it("verifies resource audience/scopes locally without a session cookie or UserInfo", async () => {
    const { pair, jwk } = await keys()
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ keys: [jwk] }))
    const token = (audience: string, scope = "chat:read") =>
      new SignJWT({ sid: "central-sid", scope })
        .setProtectedHeader({ alg: "RS256", kid: jwk.kid, typ: "at+jwt" })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject(subject)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(pair.privateKey)
    const verify = async (accessToken: string) =>
      await verifyAccessTokenRequest(
        requestToResourceInput(
          new Request(resourceUrl + "/chat/message", {
            headers: { Authorization: "Bearer " + accessToken },
          })
        ),
        {
          jwksUrl: issuer + "/jwks",
          requiredScopes: ["chat:read"],
          verifyOptions: {
            issuer,
            audience: resourceUrl,
            typ: "at+jwt",
            algorithms: ["RS256"],
            requiredClaims: ["iss", "aud", "sub", "iat", "exp"],
          },
        }
      )
    const accessToken = await token(resourceUrl)
    expect((await verify(accessToken)).sub).toBe(subject)
    expect((await verify(accessToken)).sid).toBe("central-sid")
    await expect(verify(await token(clientId))).rejects.toBeDefined()
    let insufficient: unknown
    try {
      await verify(await token(resourceUrl, "chat:write"))
    } catch (error) {
      insufficient = error
    }
    expect(isInsufficientScopeError(insufficient)).toBe(true)
    expect(network).toHaveBeenCalledOnce()
    expect(String(network.mock.calls[0]![0])).toBe(issuer + "/jwks")
  })

  it("applies signed logout once, matches SSO identity and rejects another audience", async () => {
    const { pair, jwk } = await keys()
    const markers: VerifiedLogout[] = []
    const verifier = createLogoutVerifier({
      issuer,
      clientId,
      getVerificationKey: async () => createLocalJWKSet({ keys: [jwk] }),
      storage: {
        async apply(marker) {
          if (markers.some((previous) => previous.jti === marker.jti))
            return false
          markers.push(marker)
          return true
        },
        async isRevoked(input) {
          return markers.some((marker) =>
            matchesAuthRevocation(
              {
                subject: marker.subject,
                sid: marker.sid,
                issuedAt: marker.issuedAt,
                expiresAt: marker.revokeUntil,
              },
              input,
              input.now
            )
          )
        },
      },
    })
    const logoutToken = (audience = clientId) =>
      new SignJWT({
        sid: "central-sid",
        events: { "http://schemas.openid.net/event/backchannel-logout": {} },
      })
        .setProtectedHeader({ alg: "RS256", kid: jwk.kid, typ: "logout+jwt" })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject(subject)
        .setIssuedAt()
        .setExpirationTime("2m")
        .setJti("signed-logout")
        .sign(pair.privateKey)
    const signed = await logoutToken()
    expect(await verifier.handle(signed)).toEqual({ applied: true })
    expect(await verifier.handle(signed)).toEqual({ applied: false })
    expect(markers).toHaveLength(1)
    await expect(
      verifier.verify(await logoutToken("another-app"))
    ).rejects.toBeDefined()
    const marker = markers[0]!
    const input = { subject, sid: "central-sid", issuedAt: Date.now() - 1000 }
    expect(
      matchesAuthRevocation(
        {
          ...marker,
          expiresAt: marker.revokeUntil,
        },
        input
      )
    ).toBe(true)
    expect(
      matchesAuthRevocation(
        {
          ...marker,
          expiresAt: marker.revokeUntil,
        },
        { ...input, subject: "other-sub" }
      )
    ).toBe(false)
    expect(
      matchesAuthRevocation(
        {
          ...marker,
          expiresAt: marker.revokeUntil,
        },
        { ...input, sid: "other-sid" }
      )
    ).toBe(false)
  })
})
