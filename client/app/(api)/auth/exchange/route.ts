import { NextRequest, NextResponse } from "next/server"
import {
  clearAppAuthCookies,
  clearAuthStateCookie,
  createAppSession,
  getAuthIssuer,
  getAuthReturnTo,
  getOAuthCodeVerifier,
  isValidAuthState,
  setAppSessionCookie,
  setAuthTokenCookies,
} from "@/lib/auth/dal"
import {
  getOAuthUserInfo,
  readOAuthError,
  type OAuthTokenResponse,
} from "@/lib/auth/oauth"
import { apiBaseUrl, routes, ssoOAuthClientId } from "@/lib/utils/environment"
import { getSsoUser, resolveInternalPath } from "@/lib/utils/formatter"
import type { AuthUser, SsoExchangeResponse } from "@/lib/utils/interface"

export const runtime = "nodejs"

interface OAuthDiscoveryMetadata {
  issuer?: string
  jwks_uri?: string
}

interface OAuthJsonWebKey extends JsonWebKey {
  kid?: string
  alg?: string
}

interface JsonWebKeySet {
  keys?: OAuthJsonWebKey[]
}

interface JwtHeader {
  alg?: string
  kid?: string
  typ?: string
}

interface JwtClaims {
  iss?: string
  sub?: string
  aud?: string | string[]
  exp?: number
  nbf?: number
  iat?: number
  azp?: string
  scope?: string
  email?: string
}

function noStoreJson(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  })
}

function getErrorStatus(error: unknown) {
  if (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status
  }

  return null
}

function rejectTokenQuery(request: NextRequest) {
  return (
    request.nextUrl.searchParams.has("token") ||
    request.nextUrl.searchParams.has("access_token") ||
    request.nextUrl.searchParams.has("sso_token") ||
    request.nextUrl.searchParams.has("refresh_token")
  )
}

function getPayloadValue(
  payload: FormData | Record<string, unknown>,
  key: string
) {
  const value = payload instanceof FormData ? payload.get(key) : payload[key]

  return typeof value === "string" ? value.trim() : ""
}

async function getExchangePayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? ""

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    return request.formData()
  }

  try {
    return (await request.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

function getSsoOrigin() {
  return new URL(routes.login).origin
}

function getResourceAudience(request: NextRequest) {
  return request.nextUrl.origin
}

function normalizeIssuer(value: string | null | undefined) {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)
    return url.toString().replace(/\/$/, "")
  } catch {
    return null
  }
}

function assertExpectedIssuer(request: NextRequest, issuer: string | null) {
  const returnedIssuer = normalizeIssuer(issuer)
  const expectedIssuer = normalizeIssuer(
    getAuthIssuer(request) ?? new URL("/auth", getSsoOrigin()).toString()
  )

  if (!returnedIssuer || !expectedIssuer || returnedIssuer !== expectedIssuer) {
    throw new Error("invalid_issuer")
  }

  return returnedIssuer
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url")
}

function decodeJwtPart<T>(value: string): T {
  return JSON.parse(decodeBase64Url(value).toString("utf8")) as T
}

function getJwtParts(token: string) {
  const [header, payload, signature] = token.split(".")

  if (!header || !payload || !signature) {
    throw new Error("invalid_jwt")
  }

  return {
    headerValue: header,
    payloadValue: payload,
    signatureValue: signature,
    header: decodeJwtPart<JwtHeader>(header),
    payload: decodeJwtPart<JwtClaims>(payload),
  }
}

function hasAudience(audience: JwtClaims["aud"], expected: string) {
  return Array.isArray(audience)
    ? audience.includes(expected)
    : audience === expected
}

function assertJwtClaims(
  claims: JwtClaims,
  expectedIssuer: string,
  expectedAudience: string
) {
  const now = Math.floor(Date.now() / 1000)
  const clockSkewSeconds = 60

  if (normalizeIssuer(claims.iss) !== expectedIssuer) {
    throw new Error("invalid_jwt_issuer")
  }

  if (!hasAudience(claims.aud, expectedAudience)) {
    throw new Error("invalid_jwt_audience")
  }

  if (!claims.sub) {
    throw new Error("invalid_jwt_subject")
  }

  if (typeof claims.exp !== "number" || claims.exp <= now - clockSkewSeconds) {
    throw new Error("expired_jwt")
  }

  if (typeof claims.nbf === "number" && claims.nbf > now + clockSkewSeconds) {
    throw new Error("inactive_jwt")
  }
}

function getJwtAlgorithm(alg: string) {
  switch (alg) {
    case "RS256":
      return {
        importAlgorithm: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        verifyAlgorithm: { name: "RSASSA-PKCS1-v1_5" },
      }
    case "RS384":
      return {
        importAlgorithm: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" },
        verifyAlgorithm: { name: "RSASSA-PKCS1-v1_5" },
      }
    case "RS512":
      return {
        importAlgorithm: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
        verifyAlgorithm: { name: "RSASSA-PKCS1-v1_5" },
      }
    case "ES256":
      return {
        importAlgorithm: { name: "ECDSA", namedCurve: "P-256" },
        verifyAlgorithm: { name: "ECDSA", hash: "SHA-256" },
      }
    case "ES384":
      return {
        importAlgorithm: { name: "ECDSA", namedCurve: "P-384" },
        verifyAlgorithm: { name: "ECDSA", hash: "SHA-384" },
      }
    case "ES512":
      return {
        importAlgorithm: { name: "ECDSA", namedCurve: "P-521" },
        verifyAlgorithm: { name: "ECDSA", hash: "SHA-512" },
      }
    case "EdDSA":
      return {
        importAlgorithm: { name: "Ed25519" },
        verifyAlgorithm: { name: "Ed25519" },
      }
    default:
      throw new Error("unsupported_jwt_algorithm")
  }
}

async function loadOpenIdConfiguration(issuer: string) {
  const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("openid_configuration_failed")
  }

  const metadata = (await response.json()) as OAuthDiscoveryMetadata

  if (normalizeIssuer(metadata.issuer) !== issuer || !metadata.jwks_uri) {
    throw new Error("invalid_openid_configuration")
  }

  return metadata
}

async function loadJwks(jwksUri: string) {
  const response = await fetch(jwksUri, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("jwks_failed")
  }

  const jwks = (await response.json()) as JsonWebKeySet

  if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) {
    throw new Error("invalid_jwks")
  }

  return jwks
}

function findJwk(jwks: JsonWebKeySet, header: JwtHeader) {
  const key = jwks.keys?.find((item) => {
    if (header.kid && item.kid !== header.kid) {
      return false
    }

    return !header.alg || !item.alg || item.alg === header.alg
  })

  if (!key) {
    throw new Error("jwk_not_found")
  }

  return key
}

async function verifyJwt(
  token: string,
  expectedIssuer: string,
  expectedAudience: string,
  metadata: OAuthDiscoveryMetadata
) {
  const jwt = getJwtParts(token)

  if (!jwt.header.alg) {
    throw new Error("missing_jwt_algorithm")
  }

  assertJwtClaims(jwt.payload, expectedIssuer, expectedAudience)

  const jwks = await loadJwks(metadata.jwks_uri!)
  const jwk = findJwk(jwks, jwt.header)
  const algorithm = getJwtAlgorithm(jwt.header.alg)
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    algorithm.importAlgorithm,
    false,
    ["verify"]
  )
  const verified = await crypto.subtle.verify(
    algorithm.verifyAlgorithm,
    key,
    decodeBase64Url(jwt.signatureValue),
    new TextEncoder().encode(`${jwt.headerValue}.${jwt.payloadValue}`)
  )

  if (!verified) {
    throw new Error("invalid_jwt_signature")
  }

  return jwt.payload
}

async function exchangeCode(
  request: NextRequest,
  code: string,
  codeVerifier: string
) {
  const body = new URLSearchParams()
  body.set("grant_type", "authorization_code")
  body.set("client_id", ssoOAuthClientId)
  body.set("code", code)
  body.set("code_verifier", codeVerifier)
  body.set("redirect_uri", new URL("/auth/exchange", request.url).toString())
  body.set("resource", getResourceAudience(request))

  const response = await fetch(new URL("/auth/oauth2/token", getSsoOrigin()), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await readOAuthError(response)
    throw Object.assign(new Error("oauth_code_exchange_failed"), {
      status: response.status,
      oauthError: detail?.error,
      oauthDescription: detail?.error_description,
    })
  }

  return (await response.json()) as OAuthTokenResponse
}

async function syncAppUser(accessToken: string) {
  if (!apiBaseUrl) {
    throw new Error("missing_app_server_url")
  }

  let response: Response

  try {
    response = await fetch(new URL("/auth/sync-user", apiBaseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    })
  } catch {
    throw new Error("app_user_sync_failed")
  }

  if (!response.ok) {
    throw Object.assign(new Error("app_user_sync_failed"), {
      status: response.status,
    })
  }
}

function createSsoPayload(
  request: NextRequest,
  token: OAuthTokenResponse,
  user: AuthUser,
  next: string
): SsoExchangeResponse {
  return {
    user,
    sso_sub: user.id,
    email: user.email,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    id_token: token.id_token,
    expires_in: token.expires_in,
    expires_at: token.expires_at,
    refresh_token_expires_in: token.refresh_token_expires_in,
    scope: token.scope,
    gorth_app: {
      id: ssoOAuthClientId,
      origin: request.nextUrl.origin,
      redirect_uri: new URL("/auth/exchange", request.url).toString(),
      next,
      provider: "better-auth-oauth-provider",
      issued_at: Date.now(),
    },
  }
}

function setNoStoreHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store")
  response.headers.set("Referrer-Policy", "no-referrer")
  return response
}

async function createExchangeResponse(
  request: NextRequest,
  code: string,
  state: string | null,
  issuer: string | null,
  next: string
) {
  if (!isValidAuthState(request, state)) {
    return noStoreJson({ error: "invalid_state" }, 403)
  }

  if (!code) {
    return noStoreJson({ error: "missing_code" }, 400)
  }

  const codeVerifier = getOAuthCodeVerifier(request)

  if (!codeVerifier) {
    return noStoreJson({ error: "missing_code_verifier" }, 400)
  }

  let payload: SsoExchangeResponse

  try {
    const expectedIssuer = assertExpectedIssuer(request, issuer)
    const openIdConfig = await loadOpenIdConfiguration(expectedIssuer)
    const token = await exchangeCode(request, code, codeVerifier)

    if (
      token.token_type?.toLowerCase() !== "bearer" ||
      !token.access_token ||
      !token.refresh_token ||
      !token.id_token
    ) {
      return noStoreJson({ error: "invalid_oauth_token_response" }, 502)
    }

    let idTokenClaims: JwtClaims

    try {
      idTokenClaims = await verifyJwt(
        token.id_token,
        expectedIssuer,
        ssoOAuthClientId,
        openIdConfig
      )
    } catch {
      return noStoreJson({ error: "invalid_id_token" }, 401)
    }

    try {
      await verifyJwt(
        token.access_token,
        expectedIssuer,
        getResourceAudience(request),
        openIdConfig
      )
    } catch {
      return noStoreJson({ error: "invalid_access_token" }, 401)
    }

    const userInfo = await getOAuthUserInfo(token.access_token)
    const user = userInfo.user

    if (!user || user.id !== idTokenClaims.sub) {
      throw Object.assign(new Error("oauth_userinfo_failed"), {
        status: userInfo.status,
        oauthError: userInfo.error?.error,
        oauthDescription: userInfo.error?.error_description,
      })
    }

    await syncAppUser(token.access_token)
    payload = createSsoPayload(request, token, user, next)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "oauth_code_exchange_failed"
    ) {
      const status = getErrorStatus(error)
      const detail = error as Error & {
        oauthError?: string
        oauthDescription?: string
      }

      console.error("[auth] SSO authorization-code exchange failed", {
        endpoint: "/auth/oauth2/token",
        status,
        error: detail.oauthError,
        description: detail.oauthDescription,
      })

      if (status && status >= 500) {
        return noStoreJson({ error: "oauth_token_failed" }, 502)
      }

      return noStoreJson({ error: "invalid_code" }, 401)
    }

    if (error instanceof Error && error.message === "oauth_userinfo_failed") {
      const detail = error as Error & {
        status?: number
        oauthError?: string
        oauthDescription?: string
      }

      console.error("[auth] SSO userinfo failed during code exchange", {
        endpoint: "/auth/oauth2/userinfo",
        status: detail.status,
        error: detail.oauthError,
        description: detail.oauthDescription,
      })
      return noStoreJson({ error: "oauth_userinfo_failed" }, 502)
    }

    if (
      error instanceof Error &&
      ["app_user_sync_failed", "missing_app_server_url"].includes(error.message)
    ) {
      return noStoreJson({ error: error.message }, 502)
    }

    if (error instanceof Error && error.message === "invalid_issuer") {
      return noStoreJson({ error: "invalid_issuer" }, 401)
    }

    return noStoreJson({ error: "sso_unreachable" }, 502)
  }

  const user = getSsoUser(payload)

  if (!user || !payload.access_token || !payload.refresh_token) {
    return noStoreJson({ error: "invalid_sso_response" }, 502)
  }

  const response = setNoStoreHeaders(
    NextResponse.redirect(new URL(next, request.url))
  )
  clearAuthStateCookie(response)
  clearAppAuthCookies(response)
  setAuthTokenCookies(response, payload)
  setAppSessionCookie(
    response,
    createAppSession(user, payload.gorth_app, payload.id_token)
  )

  return response
}

export async function GET(request: NextRequest) {
  if (rejectTokenQuery(request)) {
    return noStoreJson({ error: "token_query_rejected" }, 400)
  }

  return createExchangeResponse(
    request,
    request.nextUrl.searchParams.get("code")?.trim() ?? "",
    request.nextUrl.searchParams.get("state"),
    request.nextUrl.searchParams.get("iss"),
    resolveInternalPath(getAuthReturnTo(request))
  )
}

export async function POST(request: NextRequest) {
  const payload = await getExchangePayload(request)

  return createExchangeResponse(
    request,
    getPayloadValue(payload, "code"),
    getPayloadValue(payload, "state"),
    getPayloadValue(payload, "iss"),
    resolveInternalPath(
      getPayloadValue(payload, "next") || getAuthReturnTo(request)
    )
  )
}
