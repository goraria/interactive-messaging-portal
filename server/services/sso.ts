import { createPublicKey, verify as verifySignature } from "node:crypto"

import {
  authUrl,
  clientUrl,
  ssoClientUrl,
  ssoServerUrl,
} from "@/lib/utils/environment"

const metadataMaxAgeMs = 5 * 60 * 1000

interface OpenIdConfiguration {
  issuer?: string
  jwks_uri?: string
}

interface JsonWebKeySet {
  keys?: Record<string, unknown>[]
}

interface JwtHeader {
  alg?: string
  kid?: string
}

export interface SsoAccessTokenClaims {
  iss?: string
  sub: string
  aud?: string | string[]
  exp?: number
  nbf?: number
  email?: string
  name?: string | null
  preferred_username?: string | null
  status?: "active" | "inactive" | "suspended" | "deleted"
  picture?: string | null
  user_metadata?: Record<string, unknown>
  gorth_app?: Record<string, unknown>
  [key: string]: unknown
}

interface CachedOpenIdData {
  expiresAt: number
  metadata: OpenIdConfiguration
  jwks: JsonWebKeySet
}

let cachedOpenIdData: CachedOpenIdData | null = null

function normalizeUrl(value: string) {
  return new URL(value).toString().replace(/\/$/, "")
}

function urlsMatch(left: string | undefined, right: string) {
  if (!left) return false

  try {
    return normalizeUrl(left) === right
  } catch {
    return false
  }
}

function getExpectedIssuer() {
  const baseUrl = ssoClientUrl ?? authUrl
  if (!baseUrl) throw new Error("missing_sso_client_url")
  return normalizeUrl(new URL("/auth", baseUrl).toString())
}

function getExpectedAudience() {
  if (!clientUrl) throw new Error("missing_client_url")
  return new URL(clientUrl).origin
}

async function getOpenIdData(force = false) {
  if (
    !force &&
    cachedOpenIdData?.expiresAt &&
    cachedOpenIdData.expiresAt > Date.now()
  ) {
    return cachedOpenIdData
  }

  const issuer = getExpectedIssuer()
  const metadataResponse = await fetch(
    `${issuer}/.well-known/openid-configuration`,
    { headers: { Accept: "application/json" } }
  )

  if (!metadataResponse.ok) throw new Error("openid_configuration_failed")

  const metadata = (await metadataResponse.json()) as OpenIdConfiguration

  if (!urlsMatch(metadata.issuer, issuer) || !metadata.jwks_uri) {
    throw new Error("invalid_openid_configuration")
  }

  const jwksResponse = await fetch(metadata.jwks_uri, {
    headers: { Accept: "application/json" },
  })

  if (!jwksResponse.ok) throw new Error("jwks_failed")

  cachedOpenIdData = {
    expiresAt: Date.now() + metadataMaxAgeMs,
    metadata,
    jwks: (await jwksResponse.json()) as JsonWebKeySet,
  }

  return cachedOpenIdData
}

function decodeJwtPart<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T
}

function parseJwt(token: string) {
  const [headerValue, payloadValue, signatureValue] = token.split(".")

  if (!headerValue || !payloadValue || !signatureValue) {
    throw new Error("invalid_access_token")
  }

  try {
    return {
      headerValue,
      payloadValue,
      signatureValue,
      header: decodeJwtPart<JwtHeader>(headerValue),
      claims: decodeJwtPart<SsoAccessTokenClaims>(payloadValue),
    }
  } catch {
    throw new Error("invalid_access_token")
  }
}

function hasAudience(audience: string | string[] | undefined, expected: string) {
  return Array.isArray(audience)
    ? audience.includes(expected)
    : audience === expected
}

function assertClaims(claims: SsoAccessTokenClaims) {
  const now = Math.floor(Date.now() / 1000)
  const clockSkewSeconds = 60

  if (!urlsMatch(claims.iss, getExpectedIssuer())) {
    throw new Error("invalid_access_token")
  }

  if (!hasAudience(claims.aud, getExpectedAudience())) {
    throw new Error("invalid_access_token")
  }

  if (!claims.sub || !claims.exp || claims.exp <= now - clockSkewSeconds) {
    throw new Error("invalid_access_token")
  }

  if (claims.nbf && claims.nbf > now + clockSkewSeconds) {
    throw new Error("invalid_access_token")
  }
}

function verifyJwtSignature(
  algorithm: string,
  jwk: Record<string, unknown>,
  data: Buffer,
  signature: Buffer
) {
  const key = createPublicKey({
    key: jwk,
    format: "jwk",
  } as Parameters<typeof createPublicKey>[0])

  switch (algorithm) {
    case "RS256":
      return verifySignature("RSA-SHA256", data, key, signature)
    case "ES256":
      return verifySignature(
        "sha256",
        data,
        { key, dsaEncoding: "ieee-p1363" },
        signature
      )
    case "EdDSA":
      return verifySignature(null, data, key, signature)
    default:
      throw new Error("invalid_access_token")
  }
}

async function findVerificationKey(header: JwtHeader) {
  if (!header.kid || !header.alg) throw new Error("invalid_access_token")

  let openIdData = await getOpenIdData()
  let jwk = openIdData.jwks.keys?.find((key) => key.kid === header.kid)

  if (!jwk) {
    openIdData = await getOpenIdData(true)
    jwk = openIdData.jwks.keys?.find((key) => key.kid === header.kid)
  }

  if (!jwk) throw new Error("invalid_access_token")

  if (
    (typeof jwk.alg === "string" && jwk.alg !== header.alg) ||
    (typeof jwk.use === "string" && jwk.use !== "sig") ||
    (Array.isArray(jwk.key_ops) && !jwk.key_ops.includes("verify"))
  ) {
    throw new Error("invalid_access_token")
  }

  return jwk
}

export async function verifySsoAccessToken(token: string) {
  const jwt = parseJwt(token)
  const jwk = await findVerificationKey(jwt.header)
  const verified = verifyJwtSignature(
    jwt.header.alg ?? "",
    jwk,
    Buffer.from(`${jwt.headerValue}.${jwt.payloadValue}`),
    Buffer.from(jwt.signatureValue, "base64url")
  )

  if (!verified) throw new Error("invalid_access_token")
  assertClaims(jwt.claims)
  return jwt.claims
}

export async function getSsoUserInfo(accessToken: string) {
  if (!ssoServerUrl) throw new Error("missing_sso_server_url")

  const response = await fetch(new URL("/auth/oauth2/userinfo", ssoServerUrl), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? "invalid_access_token"
        : "sso_userinfo_failed"
    )
  }

  return (await response.json()) as SsoAccessTokenClaims
}
