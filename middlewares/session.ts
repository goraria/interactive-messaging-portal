import { oauthCookiePrefix } from "@/utils/environment"
import "server-only"
import { APIError } from "better-auth"
import type { MiddlewareHandler } from "hono"
import { getSessionCookie } from "better-auth/cookies"
import { AuthError } from "@gorth-io/structure/modules/auth/server"
import { readAppCredentials } from "@/services/session"
import { assertSameOrigin, assertSessionReadOrigin } from "@/lib/auth/config"
import type { AppSessionCredentials } from "@/utils/interface"

export interface SessionEnv {
  Variables: { credentials: AppSessionCredentials }
}

// Only platform forwarding needs the provider token. Better Auth owns the
// local session and provider refresh; the destination enforces its own scopes.
export function requireAppSession(): MiddlewareHandler<SessionEnv> {
  return async (context, next) => {
    context.header("Cache-Control", "no-store")
    const mutation = !["GET", "HEAD", "OPTIONS"].includes(context.req.method)
    try {
      if (mutation) assertSameOrigin(context.req.raw)
      else assertSessionReadOrigin(context.req.raw)
    } catch {
      return context.json({ error: "invalid_origin" }, 403)
    }
    try {
      const record = getSessionCookie(context.req.raw, {
        cookiePrefix: oauthCookiePrefix,
      })
        ? await readAppCredentials(context.req.raw.headers, mutation)
        : null
      if (!record) return context.json({ error: "unauthorized" }, 401)
      context.set("credentials", record)
    } catch (error) {
      if (error instanceof AuthError && error.code === "forbidden")
        return context.json({ error: "user_not_active" }, 403)
      if (error instanceof AuthError && error.code === "rejected")
        return context.json({ error: "invalid_session" }, 401)
      if (error instanceof APIError && error.statusCode === 401)
        return context.json({ error: "unauthorized" }, 401)
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : ""
      if (/^(ERR_JWT|ERR_JWS|ERR_JOSE|ERR_DPOP)/.test(code))
        return context.json({ error: "invalid_access_token" }, 401)
      return context.json({ error: "auth_unavailable" }, 503)
    }
    // Domain failures must retain their own status.
    await next()
  }
}
