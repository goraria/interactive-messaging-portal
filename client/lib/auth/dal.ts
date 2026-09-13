import "server-only"

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto"
import { v4 } from "@gorth/structure/cores/uuid"
import { cache } from "react"
import { cookies } from "next/headers"
import type { NextRequest, NextResponse } from "next/server"
import type { AuthUser } from "@/lib/utils/interface"
import {
  oauthAccessTokenMaxAge,
  oauthRefreshTokenMaxAge,
  type OAuthTokenResponse,
} from "@/lib/auth/oauth"
import {
  accessTokenCookie,
  authMaxAge,
  authSecret,
  nodeEnv,
  oauthCodeVerifierCookie,
  oauthIssuerCookie,
  oauthReturnToCookie,
  oauthStateCookie,
  refreshTokenCookie,
} from "@/lib/utils/environment"

export const gorthSessionAppCookie = "gorth.session_app"

const legacyAppAuthCookies = [
  "app-session",
  "gorth-access-token",
  "gorth-refresh-token",
  "gorth-app",
  "sb-access-auth-token",
  "sb-refresh-auth-token",
] as const
const authTransactionCookies = [
  oauthStateCookie,
  oauthCodeVerifierCookie,
  oauthReturnToCookie,
  oauthIssuerCookie,
] as const
const authTransactionMaxAgeSeconds = 5 * 60

function getPositiveInteger(value: string | undefined, fallback: number) {
  const parsedValue = Number(value)

  return Number.isSafeInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback
}

const appSessionMaxAgeSeconds = getPositiveInteger(
  authMaxAge,
  oauthRefreshTokenMaxAge
)

export interface AppSession {
  user: AuthUser
  sso_sub: string
  email?: string
  sso_id_token?: string
  gorth_app?: Record<string, unknown>
  app_user_synced_at?: number
  sso_verified_at?: number
  issued_at: number
  expires_at: number
}

function createSessionUser(user: AuthUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    image: user.image,
  }
}

let sessionKey: Buffer | null = null

function getSessionKey() {
  if (!authSecret) {
    throw new Error("NEXT_AUTH_SECRET is required")
  }

  sessionKey ??= createHash("sha256").update(authSecret).digest()

  return sessionKey
}

function encodeBase64Url(value: Buffer) {
  return value.toString("base64url")
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url")
}

function setResponseCookie(
  response: NextResponse,
  name: string,
  value: string,
  maxAge: number,
  path = "/"
) {
  response.cookies.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: nodeEnv === "production",
    path,
    maxAge,
  })
}

function clearResponseCookies(
  response: NextResponse,
  names: readonly string[],
  path = "/"
) {
  for (const name of names) {
    setResponseCookie(response, name, "", 0, path)
  }
}

function setAuthTransactionCookie(
  response: NextResponse,
  name: (typeof authTransactionCookies)[number],
  value: string
) {
  setResponseCookie(
    response,
    name,
    value,
    authTransactionMaxAgeSeconds,
    "/auth"
  )
}

function sealSession(session: AppSession) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getSessionKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    encodeBase64Url(iv),
    encodeBase64Url(tag),
    encodeBase64Url(encrypted),
  ].join(".")
}

function openSession(value: string): AppSession | null {
  const [ivValue, tagValue, encryptedValue] = value.split(".")

  if (!ivValue || !tagValue || !encryptedValue) {
    return null
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getSessionKey(),
      decodeBase64Url(ivValue)
    )
    decipher.setAuthTag(decodeBase64Url(tagValue))

    const decrypted = Buffer.concat([
      decipher.update(decodeBase64Url(encryptedValue)),
      decipher.final(),
    ])
    const session = JSON.parse(decrypted.toString("utf8")) as AppSession

    if (!session.user?.id || session.expires_at <= Date.now()) {
      return null
    }

    return session
  } catch {
    return null
  }
}

export function createAppSession(
  user: AuthUser,
  gorthApp?: Record<string, unknown>,
  ssoIdToken?: string,
  appUserSyncedAt?: number,
  ssoVerifiedAt = Date.now()
): AppSession {
  const now = Date.now()
  const sessionUser = createSessionUser(user)

  return {
    user: sessionUser,
    sso_sub: sessionUser.id,
    email: sessionUser.email,
    sso_id_token: ssoIdToken,
    gorth_app: gorthApp,
    app_user_synced_at: appUserSyncedAt,
    sso_verified_at: ssoVerifiedAt,
    issued_at: now,
    expires_at: now + appSessionMaxAgeSeconds * 1000,
  }
}

export const verifySession = cache(async () => {
  const cookieStore = await cookies()
  const sessionValue = cookieStore.get(gorthSessionAppCookie)?.value

  return sessionValue ? openSession(sessionValue) : null
})

export const getUser = cache(async () => {
  const session = await verifySession()

  return session?.user ?? null
})

export function setAppSessionCookie(
  response: NextResponse,
  session: AppSession
) {
  setResponseCookie(
    response,
    gorthSessionAppCookie,
    sealSession(session),
    appSessionMaxAgeSeconds
  )

  return response
}

export function clearAppSessionCookie(response: NextResponse) {
  clearResponseCookies(response, [
    gorthSessionAppCookie,
    ...legacyAppAuthCookies,
  ])

  return response
}

export function clearAppAuthCookies(response: NextResponse) {
  clearAppSessionCookie(response)
  clearResponseCookies(response, [accessTokenCookie, refreshTokenCookie])

  return response
}

export function setAuthTokenCookies(
  response: NextResponse,
  token: OAuthTokenResponse,
  currentRefreshToken?: string
) {
  const accessToken = token.access_token
  const refreshToken = token.refresh_token ?? currentRefreshToken

  if (!accessToken || !refreshToken) {
    throw new Error("missing_oauth_credentials")
  }

  const expiresFromTimestamp = token.expires_at
    ? Math.floor(token.expires_at - Date.now() / 1000)
    : null
  const accessTokenMaxAge = Math.max(
    1,
    expiresFromTimestamp && expiresFromTimestamp > 0
      ? expiresFromTimestamp
      : (token.expires_in ?? oauthAccessTokenMaxAge)
  )
  const refreshTokenMaxAge = Math.max(
    1,
    token.refresh_token_expires_in ?? oauthRefreshTokenMaxAge
  )

  setResponseCookie(response, accessTokenCookie, accessToken, accessTokenMaxAge)
  setResponseCookie(
    response,
    refreshTokenCookie,
    refreshToken,
    refreshTokenMaxAge
  )

  return response
}

export function createAuthState() {
  return v4()
}

export function createOAuthCodeVerifier() {
  return randomBytes(32).toString("base64url")
}

export function createOAuthCodeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url")
}

export function setAuthStateCookie(response: NextResponse, state: string) {
  setAuthTransactionCookie(response, oauthStateCookie, state)

  return response
}

export function setOAuthVerifierCookie(
  response: NextResponse,
  verifier: string
) {
  setAuthTransactionCookie(response, oauthCodeVerifierCookie, verifier)

  return response
}

export function setAuthReturnToCookie(
  response: NextResponse,
  returnTo: string
) {
  setAuthTransactionCookie(response, oauthReturnToCookie, returnTo)

  return response
}

export function setAuthIssuerCookie(response: NextResponse, issuer: string) {
  setAuthTransactionCookie(response, oauthIssuerCookie, issuer)

  return response
}

export function clearAuthStateCookie(response: NextResponse) {
  clearResponseCookies(response, authTransactionCookies, "/auth")

  return response
}

export function isValidAuthState(request: NextRequest, state: string | null) {
  const expected = request.cookies.get(oauthStateCookie)?.value

  return Boolean(state && expected && state === expected)
}

export function getOAuthCodeVerifier(request: NextRequest) {
  return request.cookies.get(oauthCodeVerifierCookie)?.value ?? null
}

export function getAuthReturnTo(request: NextRequest) {
  return request.cookies.get(oauthReturnToCookie)?.value ?? "/"
}

export function getAuthIssuer(request: NextRequest) {
  return request.cookies.get(oauthIssuerCookie)?.value ?? null
}
