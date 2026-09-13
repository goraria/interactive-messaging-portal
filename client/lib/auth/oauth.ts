import "server-only"

import { createHash } from "node:crypto"
import { ssoOAuthClientId } from "@/lib/utils/environment"
import type { AuthUser } from "@/lib/utils/interface"
import {
  getRouteOAuthUserInfo,
  refreshRouteOAuthToken,
  revokeRouteOAuthToken,
  syncRouteAppUser,
} from "@/services/route"

export const oauthAccessTokenMaxAge = 60 * 60
export const oauthRefreshTokenMaxAge = 60 * 60 * 24 * 30

export interface OAuthTokenResponse {
  access_token?: string
  refresh_token?: string
  id_token?: string
  token_type?: string
  expires_in?: number
  expires_at?: number
  refresh_token_expires_in?: number
  scope?: string
}

export interface OAuthErrorPayload {
  error?: string
  error_description?: string
}

interface OAuthUserInfoResponse {
  sub?: string
  email?: string
  email_verified?: boolean
  name?: string
  preferred_username?: string | null
  picture?: string
  updated_at?: string
}

export interface OAuthUserInfoResult {
  user: AuthUser | null
  status: number
  error: OAuthErrorPayload | null
}

const refreshRequests = new Map<string, Promise<OAuthTokenResponse>>()

function getTokenFingerprint(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function readOAuthError(payload: unknown) {
  return payload && typeof payload === "object"
    ? (payload as OAuthErrorPayload)
    : null
}

export async function syncAppUser(accessToken: string) {
  let response: Awaited<ReturnType<typeof syncRouteAppUser>>

  try {
    response = await syncRouteAppUser(accessToken)
  } catch (error) {
    console.error("[auth] Chat user sync request failed", {
      endpoint: "/auth/sync-user",
      message: error instanceof Error ? error.message : "unknown_error",
    })
    throw new Error("app_user_sync_failed")
  }

  if (response.status < 200 || response.status >= 300) {
    const detail = readOAuthError(response.data)
    console.error("[auth] Chat user sync failed", {
      endpoint: "/auth/sync-user",
      status: response.status,
      error: detail?.error,
      description: detail?.error_description,
    })
    throw Object.assign(new Error("app_user_sync_failed"), {
      status: response.status,
    })
  }

  console.info("[auth] Chat user synced", {
    endpoint: "/auth/sync-user",
    status: response.status,
  })
}

export function getJwtExpiration(token: string) {
  try {
    const [, payload] = token.split(".")
    if (!payload) return null
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { exp?: unknown }
    return typeof claims.exp === "number" ? claims.exp : null
  } catch {
    return null
  }
}

export function isAccessTokenExpired(token: string, clockSkewSeconds = 30) {
  const expiration = getJwtExpiration(token)
  return (
    expiration !== null && expiration <= Date.now() / 1000 + clockSkewSeconds
  )
}

export function shouldRefreshCredentials(
  accessToken: string,
  result: OAuthUserInfoResult
) {
  if (isAccessTokenExpired(accessToken)) return true
  if (!result.error) return false
  if (result.error.error === "invalid_token") return true
  if (result.error.error !== "invalid_request") return false

  const description = result.error.error_description?.toLowerCase() ?? ""
  return ["access token", "jwt signature", "invalid jwt"].some((value) =>
    description.includes(value)
  )
}

export async function getOAuthUserInfo(
  accessToken: string
): Promise<OAuthUserInfoResult> {
  const response =
    await getRouteOAuthUserInfo<OAuthUserInfoResponse>(accessToken)

  if (response.status < 200 || response.status >= 300) {
    return {
      user: null,
      status: response.status,
      error: readOAuthError(response.data),
    }
  }

  const userInfo = response.data
  if (!userInfo.sub || !userInfo.email) {
    return {
      user: null,
      status: 502,
      error: {
        error: "invalid_userinfo_response",
        error_description: "userinfo response is missing sub or email",
      },
    }
  }

  return {
    status: response.status,
    error: null,
    user: {
      id: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name ?? userInfo.email,
      username: userInfo.preferred_username ?? null,
      image: userInfo.picture ?? null,
    },
  }
}

async function requestTokenRefresh(
  refreshToken: string,
  resource: string
): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams()
  body.set("grant_type", "refresh_token")
  body.set("client_id", ssoOAuthClientId)
  body.set("refresh_token", refreshToken)
  body.set("resource", resource)

  const response = await refreshRouteOAuthToken<OAuthTokenResponse>(body)

  if (response.status < 200 || response.status >= 300) {
    const detail = readOAuthError(response.data)
    throw Object.assign(new Error("oauth_refresh_failed"), {
      status: response.status,
      oauthError: detail?.error,
      oauthDescription: detail?.error_description,
    })
  }

  const token = response.data
  if (token.token_type?.toLowerCase() !== "bearer" || !token.access_token) {
    throw new Error("invalid_oauth_refresh_response")
  }

  return token
}

export function refreshOAuthTokens(refreshToken: string, resource: string) {
  const fingerprint = getTokenFingerprint(refreshToken)
  const activeRequest = refreshRequests.get(fingerprint)
  if (activeRequest) return activeRequest

  const request = requestTokenRefresh(refreshToken, resource).finally(() => {
    refreshRequests.delete(fingerprint)
  })
  refreshRequests.set(fingerprint, request)
  return request
}

export async function revokeOAuthToken(
  token: string,
  tokenType: "access_token" | "refresh_token"
) {
  const body = new URLSearchParams()
  body.set("client_id", ssoOAuthClientId)
  body.set("token", token)
  body.set("token_type_hint", tokenType)

  const response = await revokeRouteOAuthToken(body)

  if (response.status < 200 || response.status >= 300) {
    const detail = readOAuthError(response.data)
    console.error("[auth] SSO token revocation failed", {
      endpoint: "/auth/oauth2/revoke",
      status: response.status,
      error: detail?.error,
      description: detail?.error_description,
      tokenType,
    })
  }
}
