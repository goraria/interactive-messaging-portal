import { NextRequest, NextResponse } from "next/server"
import {
  clearAppAuthCookies,
  createAppSession,
  setAppSessionCookie,
  setAuthTokenCookies,
  verifySession,
} from "@/lib/auth/dal"
import {
  accessTokenCookie,
  refreshTokenCookie,
  routes,
  ssoOAuthClientId,
} from "@/lib/utils/environment"
import {
  getOAuthUserInfo,
  isAccessTokenExpired,
  refreshOAuthTokens,
  revokeOAuthToken,
  shouldRefreshCredentials,
  syncAppUser,
  type OAuthUserInfoResult,
  type OAuthTokenResponse,
} from "@/lib/auth/oauth"

export const runtime = "nodejs"

interface OAuthFailure extends Error {
  status?: number
  oauthError?: string
  oauthDescription?: string
}

function getOAuthFailure(error: unknown) {
  return error instanceof Error ? (error as OAuthFailure) : null
}

function logOAuthFailure(
  operation: "userinfo" | "refresh",
  detail: {
    status?: number
    error?: string
    description?: string
    message?: string
  }
) {
  console.error(`[auth] SSO ${operation} failed`, {
    endpoint:
      operation === "userinfo" ? "/auth/oauth2/userinfo" : "/auth/oauth2/token",
    ...detail,
  })
}

function noStoreJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  })
}

function unauthenticated() {
  const response = noStoreJson({ user: null, error: "unauthorized" }, 401)
  clearAppAuthCookies(response)
  return response
}

function ssoUnavailable() {
  return noStoreJson({ user: null, error: "sso_unavailable" }, 502)
}

const appUserSyncIntervalMs = 5 * 60 * 1000

async function syncAppUserWhenStale(
  accessToken: string,
  syncedAt: number | undefined
) {
  if (syncedAt && Date.now() - syncedAt < appUserSyncIntervalMs) {
    return syncedAt
  }

  await syncAppUser(accessToken)
  return Date.now()
}

function logUserInfoFailure(result: OAuthUserInfoResult) {
  logOAuthFailure("userinfo", {
    status: result.status,
    error: result.error?.error,
    description: result.error?.error_description,
  })
}

function getEndSessionUrl(request: NextRequest, idToken?: string) {
  if (!idToken) return null

  const url = new URL("/auth/oauth2/end-session", new URL(routes.login).origin)
  url.searchParams.set("id_token_hint", idToken)
  url.searchParams.set("client_id", ssoOAuthClientId)
  url.searchParams.set("post_logout_redirect_uri", request.nextUrl.origin)

  return url.toString()
}

const sessionRevalidationMs = 2 * 60 * 1000

function isSessionRecentlyVerified(verifiedAt: number | undefined) {
  return Boolean(verifiedAt && Date.now() - verifiedAt < sessionRevalidationMs)
}

async function verifyAccessToken(accessToken: string) {
  try {
    return await getOAuthUserInfo(accessToken)
  } catch (error) {
    logOAuthFailure("userinfo", {
      message: error instanceof Error ? error.message : "unknown_error",
    })
    return null
  }
}

function responseWithRefreshedCredentials(
  response: NextResponse,
  token: OAuthTokenResponse,
  currentRefreshToken: string
) {
  setAuthTokenCookies(response, token, currentRefreshToken)
  return response
}

export async function GET(request: NextRequest) {
  const session = await verifySession()
  const accessToken = request.cookies.get(accessTokenCookie)?.value
  const refreshToken = request.cookies.get(refreshTokenCookie)?.value

  if (!session || !refreshToken) {
    return unauthenticated()
  }

  if (
    accessToken &&
    !isAccessTokenExpired(accessToken) &&
    isSessionRecentlyVerified(session.sso_verified_at)
  ) {
    return noStoreJson({
      user: session.user,
      gorth_app: session.gorth_app,
    })
  }

  if (accessToken && !isAccessTokenExpired(accessToken)) {
    const userInfo = await verifyAccessToken(accessToken)

    if (!userInfo) {
      return ssoUnavailable()
    }

    if (userInfo.user) {
      if (userInfo.user.id !== session.sso_sub) {
        logOAuthFailure("userinfo", {
          status: userInfo.status,
          error: "subject_mismatch",
        })
        return unauthenticated()
      }

      let appUserSyncedAt: number
      try {
        appUserSyncedAt = await syncAppUserWhenStale(
          accessToken,
          session.app_user_synced_at
        )
      } catch {
        return noStoreJson({ user: null, error: "app_user_sync_failed" }, 502)
      }

      const response = noStoreJson({
        user: userInfo.user,
        gorth_app: session.gorth_app,
      })

      setAppSessionCookie(
        response,
        createAppSession(
          userInfo.user,
          session.gorth_app,
          session.sso_id_token,
          appUserSyncedAt
        )
      )

      return response
    }

    logUserInfoFailure(userInfo)

    if (userInfo.status >= 500) {
      return ssoUnavailable()
    }

    if (!shouldRefreshCredentials(accessToken, userInfo)) {
      return unauthenticated()
    }
  }

  let refreshedToken: OAuthTokenResponse

  try {
    refreshedToken = await refreshOAuthTokens(
      refreshToken,
      request.nextUrl.origin
    )
  } catch (error) {
    const failure = getOAuthFailure(error)
    logOAuthFailure("refresh", {
      status: failure?.status,
      error: failure?.oauthError,
      description: failure?.oauthDescription,
      message: failure?.message,
    })

    return failure?.status && failure.status >= 500
      ? ssoUnavailable()
      : unauthenticated()
  }

  const refreshedAccessToken = refreshedToken.access_token
  if (!refreshedAccessToken) {
    logOAuthFailure("refresh", { error: "missing_access_token" })
    return unauthenticated()
  }

  const refreshedUserInfo = await verifyAccessToken(refreshedAccessToken)
  if (!refreshedUserInfo) {
    return responseWithRefreshedCredentials(
      ssoUnavailable(),
      refreshedToken,
      refreshToken
    )
  }

  if (refreshedUserInfo.status >= 500) {
    logUserInfoFailure(refreshedUserInfo)
    return responseWithRefreshedCredentials(
      ssoUnavailable(),
      refreshedToken,
      refreshToken
    )
  }

  const user = refreshedUserInfo.user
  if (!user || user.id !== session.sso_sub) {
    logUserInfoFailure(refreshedUserInfo)
    return unauthenticated()
  }

  let appUserSyncedAt: number
  try {
    appUserSyncedAt = await syncAppUserWhenStale(
      refreshedAccessToken,
      session.app_user_synced_at
    )
  } catch {
    return noStoreJson({ user: null, error: "app_user_sync_failed" }, 502)
  }

  const response = noStoreJson({
    user,
    gorth_app: session.gorth_app,
  })
  responseWithRefreshedCredentials(response, refreshedToken, refreshToken)
  setAppSessionCookie(
    response,
    createAppSession(
      user,
      session.gorth_app,
      refreshedToken.id_token ?? session.sso_id_token,
      appUserSyncedAt
    )
  )

  return response
}

export async function DELETE(request: NextRequest) {
  const session = await verifySession()
  const refreshToken = request.cookies.get(refreshTokenCookie)?.value
  const response = noStoreJson({
    user: null,
    logout_url: getEndSessionUrl(request, session?.sso_id_token),
  })
  const logoutRequests: Promise<unknown>[] = []

  if (refreshToken) {
    logoutRequests.push(revokeOAuthToken(refreshToken, "refresh_token"))
  }
  const results = await Promise.allSettled(logoutRequests)
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[auth] SSO logout request failed", {
        message:
          result.reason instanceof Error
            ? result.reason.message
            : "unknown_error",
      })
    }
  }

  clearAppAuthCookies(response)
  return response
}
