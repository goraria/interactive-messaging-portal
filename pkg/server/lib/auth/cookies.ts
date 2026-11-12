import type { Context } from "hono"
import { deleteCookie, setCookie } from "hono/cookie"
import {
  AuthError,
  type SessionCredentials,
} from "@gorth/structure/modules/auth/server"
import {
  isProduction,
  accessTokenCookie,
  refreshTokenCookie,
  sessionAppCookie,
  oauthStateCookie,
  oauthCodeVerifierCookie,
  oauthReturnToCookie,
  oauthIssuerCookie,
  oauthNonceCookie,
} from "@/utils/environment"
import type { AuthAccount } from "@/lib/auth/store"

export const authCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "Lax" as const,
  path: "/",
}

// Ambiguous duplicate cookies must not select another app's handle.
export function readAuthCookie(request: Request, name: string) {
  if (!name || !/^[A-Za-z0-9_.-]+$/.test(name))
    throw new AuthError("invalid_configuration")
  const matches = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(name + "="))
  if (matches.length !== 1) return null
  try {
    return decodeURIComponent(matches[0]!.slice(name.length + 1))
  } catch {
    return null
  }
}

export function readSessionHandle(request: Request) {
  const handle = readAuthCookie(request, sessionAppCookie)
  return handle && /^[A-Za-z0-9_-]{43}$/.test(handle) ? handle : null
}

export function setSessionCookie(
  context: Context,
  handle: string,
  expiresAt: number
) {
  setCookie(context, sessionAppCookie, handle, {
    ...authCookieOptions,
    expires: new Date(expiresAt),
  })
}

export function setCredentialCookies(
  context: Context,
  record: SessionCredentials<AuthAccount>
) {
  setCookie(context, accessTokenCookie, record.credentials.accessToken, {
    ...authCookieOptions,
    expires: new Date(
      Math.min(record.expiresAt, record.credentials.accessExpiresAt)
    ),
  })
  // Preserve the HttpOnly cookie contract; refresh is performed exclusively
  // from the encrypted DB record, never from an incoming token cookie.
  if (record.credentials.refreshToken)
    setCookie(context, refreshTokenCookie, record.credentials.refreshToken, {
      ...authCookieOptions,
      expires: new Date(record.expiresAt),
    })
  else deleteCookie(context, refreshTokenCookie, authCookieOptions)
}

export function clearTransactionCookies(context: Context) {
  for (const name of [
    oauthStateCookie,
    oauthCodeVerifierCookie,
    oauthReturnToCookie,
    oauthIssuerCookie,
    oauthNonceCookie,
  ])
    if (name)
      deleteCookie(context, name, { ...authCookieOptions, path: "/auth" })
}

export function clearAppCookies(context: Context) {
  for (const name of [
    sessionAppCookie,
    accessTokenCookie,
    refreshTokenCookie,
    "app-session",
    "gorth-access-token",
    "gorth-refresh-token",
    "gorth-app",
    "sb-access-auth-token",
    "sb-refresh-auth-token",
  ])
    if (name) deleteCookie(context, name, authCookieOptions)
  clearTransactionCookies(context)
}
