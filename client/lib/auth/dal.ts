import "server-only"

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto"
import { v4 as uuidv4 } from "@gorth/structure/cores/uuid"
import { cache } from "react"
import { cookies } from "next/headers"
import type { NextRequest, NextResponse } from "next/server"
import type { AuthUser } from "@/lib/utils/interface"
import {
  oauthAccessTokenMaxAge,
  oauthRefreshTokenMaxAge,
  type OAuthTokenResponse,
} from "@/lib/auth/oauth"

export const gorthAccessTokenCookie = "gorth.access_token"
export const gorthRefreshTokenCookie = "gorth.refresh_token"
export const gorthSessionAppCookie = "gorth.session_app"

const legacyAppAuthCookies = [
  "app-session",
  "gorth-access-token",
  "gorth-refresh-token",
  "gorth-app",
  "sb-access-auth-token",
  "sb-refresh-auth-token",
]
const authStateCookie = "app-auth-state"
const authCodeVerifierCookie = "app-auth-code-verifier"
const authReturnToCookie = "app-auth-return-to"
const authIssuerCookie = "app-auth-issuer"
const appSessionMaxAgeSeconds = Number(
  process.env.APP_SESSION_MAX_AGE_SECONDS ?? 24 * 60 * 60
)

export interface AppSession {
  user: AuthUser
  sso_sub: string
  email?: string
  sso_id_token?: string
  gorth_app?: Record<string, unknown>
  app_user_synced_at?: number
  issued_at: number
  expires_at: number
}

function createSessionUser(user: AuthUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
  }
}

function getSessionSecret() {
  const secret = process.env.APP_SESSION_SECRET ?? process.env.SESSION_SECRET

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("Missing APP_SESSION_SECRET")
  }

  return (
    secret ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "development-session-secret"
  )
}

function getSessionKey() {
  return createHash("sha256").update(getSessionSecret()).digest()
}

function encodeBase64Url(value: Buffer) {
  return value.toString("base64url")
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url")
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
  appUserSyncedAt?: number
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
  response.cookies.set(gorthSessionAppCookie, sealSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: appSessionMaxAgeSeconds,
  })

  return response
}

export function clearAppSessionCookie(response: NextResponse) {
  response.cookies.set(gorthSessionAppCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
  for (const cookieName of legacyAppAuthCookies) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    })
  }

  return response
}

export function clearAppAuthCookies(response: NextResponse) {
  clearAppSessionCookie(response)
  response.cookies.set(gorthAccessTokenCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
  response.cookies.set(gorthRefreshTokenCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })

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

  response.cookies.set(gorthAccessTokenCookie, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: accessTokenMaxAge,
  })
  response.cookies.set(gorthRefreshTokenCookie, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: refreshTokenMaxAge,
  })

  return response
}

export function createAuthState() {
  return uuidv4()
}

export function createOAuthCodeVerifier() {
  return randomBytes(32).toString("base64url")
}

export function createOAuthCodeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url")
}

export function setAuthStateCookie(response: NextResponse, state: string) {
  response.cookies.set(authStateCookie, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
    maxAge: 5 * 60,
  })

  return response
}

export function setOAuthVerifierCookie(
  response: NextResponse,
  verifier: string
) {
  response.cookies.set(authCodeVerifierCookie, verifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
    maxAge: 5 * 60,
  })

  return response
}

export function setAuthReturnToCookie(
  response: NextResponse,
  returnTo: string
) {
  response.cookies.set(authReturnToCookie, returnTo, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
    maxAge: 5 * 60,
  })

  return response
}

export function setAuthIssuerCookie(response: NextResponse, issuer: string) {
  response.cookies.set(authIssuerCookie, issuer, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
    maxAge: 5 * 60,
  })

  return response
}

export function clearAuthStateCookie(response: NextResponse) {
  response.cookies.set(authStateCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
    maxAge: 0,
  })
  response.cookies.set(authCodeVerifierCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
    maxAge: 0,
  })
  response.cookies.set(authReturnToCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
    maxAge: 0,
  })
  response.cookies.set(authIssuerCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
    maxAge: 0,
  })
  return response
}

export function isValidAuthState(request: NextRequest, state: string | null) {
  const expected = request.cookies.get(authStateCookie)?.value

  return Boolean(state && expected && state === expected)
}

export function getOAuthCodeVerifier(request: NextRequest) {
  return request.cookies.get(authCodeVerifierCookie)?.value ?? null
}

export function getAuthReturnTo(request: NextRequest) {
  return request.cookies.get(authReturnToCookie)?.value ?? "/"
}

export function getAuthIssuer(request: NextRequest) {
  return request.cookies.get(authIssuerCookie)?.value ?? null
}
