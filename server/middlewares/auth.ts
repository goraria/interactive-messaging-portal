import type { NextFunction, Request, Response } from "express"

import {
  getSsoUserInfo,
  verifySsoAccessToken,
  type SsoAccessTokenClaims,
} from "@/services/sso"
import { accessTokenCookie } from "@/lib/utils/environment"
import { findUserByExternalId } from "@/services/users"

const gorthAppClaim = "https://gorth.dev/claims/app"
const authUserStatuses = ["active", "inactive", "suspended", "deleted"] as const

type AuthUserStatus = (typeof authUserStatuses)[number]

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
}

export interface RequireAuthOptions {
  freshProfile?: boolean
}

function getAccessToken(request: Request) {
  const authorization = request.get("authorization")

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim()
  }

  return request.cookies?.[accessTokenCookie] ?? ""
}

function getMetadataValue(
  metadata: Record<string, unknown> | undefined,
  key: string
) {
  const value = metadata?.[key]
  return typeof value === "string" ? value : null
}

function getAuthUserStatus(value: unknown): AuthUserStatus {
  return authUserStatuses.includes(value as AuthUserStatus)
    ? (value as AuthUserStatus)
    : "active"
}

function toFreshAuthUser(payload: SsoAccessTokenClaims): AuthUser | null {
  if (!payload.sub || !payload.email) return null

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name ?? getMetadataValue(payload.user_metadata, "name"),
    username:
      payload.preferred_username ??
      getMetadataValue(payload.user_metadata, "username"),
    image:
      payload.picture ??
      getMetadataValue(payload.user_metadata, "avatar_url") ??
      getMetadataValue(payload.user_metadata, "picture"),
    status: getAuthUserStatus(payload.status),
  }
}

function getAppClaim(payload: SsoAccessTokenClaims) {
  const claim = payload[gorthAppClaim]

  if (claim && typeof claim === "object") {
    return claim as Record<string, unknown>
  }

  return payload.gorth_app ?? null
}

export function requireAuth(options: RequireAuthOptions = {}) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const accessToken = getAccessToken(request)

    if (!accessToken) {
      return response.status(401).json({ error: "missing_access_token" })
    }

    try {
      const claims = await verifySsoAccessToken(accessToken)
      const localUser = options.freshProfile
        ? null
        : await findUserByExternalId(claims.sub)
      let user: AuthUser | null = localUser
        ? {
            id: localUser.externalUserId,
            email: localUser.email,
            name: localUser.name,
            username: localUser.username,
            image: localUser.image,
            status: localUser.status,
          }
        : null
      let app = getAppClaim(claims)

      if (!user) {
        const userInfo = await getSsoUserInfo(accessToken)
        user = toFreshAuthUser(userInfo)
        app = getAppClaim(userInfo) ?? app
      }

      if (!user) {
        return response.status(401).json({ error: "invalid_access_token" })
      }

      response.locals.auth = {
        authenticated: true,
        verifiedBy: "single-sign-on",
        user,
        app,
      } satisfies AuthContext

      return next()
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error"

      if (message === "invalid_access_token") {
        return response.status(401).json({ error: "invalid_access_token" })
      }

      console.error("[auth] SSO verification failed", { message })
      return response.status(502).json({ error: "sso_unavailable" })
    }
  }
}
