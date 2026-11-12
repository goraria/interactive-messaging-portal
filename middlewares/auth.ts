import { oauthCookiePrefix } from "@/utils/environment"
import "server-only"
import { APIError } from "better-auth"
import type { MiddlewareHandler } from "hono"
import { getSessionCookie } from "better-auth/cookies"
import { AuthError } from "@gorth-io/structure/modules/auth/server"
import { isInsufficientScopeError } from "better-auth/oauth2"
import {
  getVerifiedSsoUserInfo,
  verifySsoAccessTokenRequest,
} from "@/services/sso"
import { oauthReadScope, oauthWriteScope } from "@/utils/environment"
import { formatSsoAuthUser, getAppClaim } from "@/utils/formatter"
import { findUserByExternalId } from "@/services/users"
import { readAppIdentity, readAppCredentials } from "@/services/session"
import { assertSameOrigin, assertSessionReadOrigin } from "@/lib/auth/config"
import type { ApiEnv } from "@/utils/interface"

export function requireAuth(
  options: { freshProfile?: boolean; requiredScopes?: string[] } = {}
): MiddlewareHandler<ApiEnv> {
  return async (context, next) => {
    const mutation = !["GET", "HEAD", "OPTIONS"].includes(context.req.method)
    const requiredScopes = options.requiredScopes ?? [
      mutation ? oauthWriteScope : oauthReadScope,
    ]
    try {
      const authorization = context.req.header("authorization")
      const accessToken = authorization?.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : ""
      if (!authorization) {
        if (mutation) assertSameOrigin(context.req.raw)
        else assertSessionReadOrigin(context.req.raw)
        const identity = getSessionCookie(context.req.raw, {
          cookiePrefix: oauthCookiePrefix,
        })
          ? await readAppIdentity(context.req.raw.headers)
          : null
        if (!identity) return context.json({ error: "unauthorized" }, 401)
        if (
          identity.user.status !== "active" ||
          identity.user.deletedAt ||
          (identity.user.bannedAt &&
            (!identity.user.banExpires ||
              identity.user.banExpires > new Date()))
        )
          return context.json({ error: "user_not_active" }, 403)
        // Local APIs authenticate the native app session, not an OAuth token.
        // Explicit sensitive actions and stale identities retain a live SSO check.
        const session =
          options.freshProfile ||
          identity.user.syncedAt.getTime() <= Date.now() - 120_000
            ? await readAppCredentials(context.req.raw.headers, true)
            : identity
        if (!session) return context.json({ error: "unauthorized" }, 401)
        context.set("auth", {
          // The session reader already enforces local status/revocation policy.
          authenticated: true,
          verifiedBy: "better-auth",
          user: {
            id: session.subject,
            email: session.user.email,
            name: session.user.name,
            username: session.user.username,
            image: session.user.image,
            status: "active",
          },
          app: null,
          // OAuth scopes apply to delegated bearer requests, not local sessions.
          scopes: [],
          sessionId: session.sid,
          localRole: session.user.role,
        })
        // Authorization complete; domain errors must remain outside the auth catch.
      } else {
        if (!accessToken)
          return context.json(
            { error: "missing_app_session_or_access_token" },
            401
          )
        const claims = await verifySsoAccessTokenRequest(
          context.req.raw,
          requiredScopes,
          accessToken,
          options
        )
        const info = await getVerifiedSsoUserInfo(context.req.raw, accessToken)
        const remote = formatSsoAuthUser(info)
        const local = await findUserByExternalId(claims.sub)
        if (
          !remote ||
          remote.status !== "active" ||
          (local &&
            (local.status !== "active" || local.bannedAt || local.deletedAt))
        )
          return context.json({ error: "user_not_active" }, 403)
        context.set("auth", {
          authenticated: true,
          verifiedBy: "single-sign-on",
          user: local
            ? {
                id: local.externalUserId,
                email: local.email,
                name: local.name,
                username: local.username,
                image: local.image,
                status: "active",
              }
            : remote,
          app:
            getAppClaim(info, "https://gorth.dev/claims/app") ??
            getAppClaim(claims, "https://gorth.dev/claims/app"),
          scopes: (claims.scope ?? "").split(" ").filter(Boolean),
          sessionId: claims.sid ?? null,
          localRole: local?.role ?? null,
        })
      }
    } catch (error) {
      if (error instanceof AuthError) {
        const status = ["unavailable", "invalid_configuration"].includes(
          error.code
        )
          ? 503
          : error.code === "forbidden" || error.code === "rejected"
            ? 403
            : 401
        return context.json({ error: error.code }, status)
      }
      if (isInsufficientScopeError(error)) {
        const scope =
          typeof error.body?.scope === "string" ? error.body.scope : undefined
        context.header(
          "WWW-Authenticate",
          `Bearer error="insufficient_scope"${scope ? `, scope=${JSON.stringify(scope)}` : ""}`
        )
        return context.json(
          { error: "insufficient_scope", ...(scope ? { scope } : {}) },
          403
        )
      }
      // Unknown DB/provider failures are not evidence of an invalid credential.
      if (error instanceof APIError) {
        const status =
          error.statusCode === 401 ? 401 : error.statusCode === 403 ? 403 : 503
        return context.json(
          { error: status === 503 ? "auth_unavailable" : "unauthorized" },
          status
        )
      }
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : ""
      if (/^(ERR_JWT|ERR_JWS|ERR_JOSE|ERR_DPOP)/.test(code))
        return context.json({ error: "invalid_access_token" }, 401)
      return context.json({ error: "auth_unavailable" }, 503)
    }
    // Downstream domain/DB failures must not be converted into token errors.
    await next()
  }
}
