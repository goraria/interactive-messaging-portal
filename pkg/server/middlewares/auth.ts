import { AuthError } from "@gorth/structure/modules/auth/server"
import { isInsufficientScopeError } from "better-auth/oauth2"

import type { NextFunction, Request, Response } from "@/lib/http"
import {
  getVerifiedSsoUserInfo,
  verifySsoAccessTokenRequest,
} from "@/services/sso"
import {
  accessTokenCookie,
  oauthReadScope,
  oauthWriteScope,
} from "@/utils/environment"
import {
  formatSsoAuthUser,
  getAppClaim,
  type AuthUserStatus,
} from "@/utils/formatter"
import { findUserByExternalId } from "@/services/users"
import { getAuthRuntime } from "@/lib/auth/runtime"
import { assertSameOrigin, assertSessionReadOrigin } from "@/lib/auth/config"
import { readSessionHandle, authCookieOptions } from "@/lib/auth/cookies"
import { refreshTokenCookie } from "@/utils/environment"

const gorthAppClaim = "https://gorth.dev/claims/app"
const allowedStatus = "active"

export interface AuthUser {
  id: string
  email: string
  name: string | null
  username: string | null
  image: string | null
  status: AuthUserStatus
}

export interface AuthContext {
  authenticated: true
  verifiedBy: "single-sign-on"
  user: AuthUser
  app: Record<string, unknown> | null
  scopes: string[]
  sessionId: string | null
  localRole: string | null
}

export interface RequireAuthOptions {
  freshProfile?: boolean
  requiredScopes?: string[]
}

function getAccessToken(request: Request) {
  const authorization = request.get("authorization")
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim()
  }
  return ""
}

export function requireAuth(options: RequireAuthOptions = {}) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const requiredScopes =
      options.requiredScopes ??
      (["GET", "HEAD", "OPTIONS"].includes(request.method)
        ? [oauthReadScope]
        : [oauthWriteScope])

    try {
      const mutation = !["GET", "HEAD", "OPTIONS"].includes(request.method)
      let accessToken = getAccessToken(request)
      let session = null
      if (!request.get("authorization")) {
        try {
          if (mutation) assertSameOrigin(request.raw)
          else assertSessionReadOrigin(request.raw)
        } catch (error) {
          if (
            !(error instanceof AuthError) ||
            error.code === "invalid_configuration"
          )
            throw error
          return response.status(403).json({ error: "invalid_origin" })
        }
        const handle = readSessionHandle(request.raw)
        session = handle
          ? await getAuthRuntime().credentials(
              handle,
              mutation || Boolean(options.freshProfile)
            )
          : null
        if (session) {
          accessToken = session.credentials.accessToken
          response.cookie(accessTokenCookie, accessToken, {
            ...authCookieOptions,
            expires: new Date(
              Math.min(session.expiresAt, session.credentials.accessExpiresAt)
            ),
          })
          if (session.credentials.refreshToken)
            response.cookie(
              refreshTokenCookie,
              session.credentials.refreshToken,
              {
                ...authCookieOptions,
                expires: new Date(session.expiresAt),
              }
            )
        }
      }
      // Raw access-token cookies cannot bypass the authoritative app handle.
      if (!accessToken)
        return response
          .status(401)
          .json({ error: "missing_app_session_or_access_token" })
      const claims = await verifySsoAccessTokenRequest(
        request.raw,
        requiredScopes,
        accessToken,
        { ...options, session: session ?? undefined }
      )

      // Signature, scope and durable revocation are checked on every request.
      // Routine identity reads share a bounded cache; mutations force SSO.
      const userInfo = await getVerifiedSsoUserInfo(request.raw, accessToken)
      const remoteUser = formatSsoAuthUser(userInfo)
      const localUser =
        session?.user ?? (await findUserByExternalId(claims.sub))

      if (
        !remoteUser ||
        remoteUser.status !== allowedStatus ||
        (localUser &&
          (localUser.status !== allowedStatus ||
            localUser.bannedAt ||
            localUser.deletedAt))
      ) {
        return response.status(403).json({ error: "user_not_active" })
      }

      const user: AuthUser = localUser
        ? {
            id: localUser.externalUserId,
            email: localUser.email,
            name: localUser.name,
            username: localUser.username,
            image: localUser.image,
            status: localUser.status as AuthUserStatus,
          }
        : remoteUser

      response.locals.auth = {
        authenticated: true,
        verifiedBy: "single-sign-on",
        user,
        app:
          getAppClaim(userInfo, gorthAppClaim) ??
          getAppClaim(claims, gorthAppClaim),
        scopes: (claims.scope ?? "").split(" ").filter(Boolean),
        sessionId: claims.sid ?? null,
        localRole: localUser?.role ?? null,
      } satisfies AuthContext

      return next()
    } catch (error) {
      if (error instanceof AuthError) {
        const status =
          error.code === "unavailable" || error.code === "invalid_configuration"
            ? 503
            : error.code === "forbidden"
              ? 403
              : 401
        return response.status(status).json({ error: error.code })
      }
      if (isInsufficientScopeError(error)) {
        const body = error.body ?? {}
        const description =
          typeof body.error_description === "string"
            ? body.error_description
            : undefined
        const scope = typeof body.scope === "string" ? body.scope : undefined
        response.setHeader(
          "WWW-Authenticate",
          `Bearer error="insufficient_scope"${scope ? `, scope="${scope}"` : ""}`
        )
        return response.status(403).json({
          error: "insufficient_scope",
          ...(description ? { description } : {}),
          ...(scope ? { scope } : {}),
        })
      }
      const message = error instanceof Error ? error.message : "unknown_error"
      if (
        message === "sso_userinfo_failed" ||
        message === "openid_configuration_failed" ||
        message === "invalid_openid_configuration"
      ) {
        console.error("[auth] SSO unavailable", { message })
        return response.status(502).json({ error: "sso_unavailable" })
      }
      console.error("[auth] Access token verification failed", { message })
      return response.status(401).json({ error: "invalid_access_token" })
    }
  }
}
