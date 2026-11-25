import "server-only";
import { getSessionCookie } from "better-auth/cookies";
import type { MiddlewareHandler } from "hono";
import { rawReadAppCredentials } from "@/models/session";
import { assertSessionOrigin } from "@/lib/auth/config";
import { classifyAuthError, isMutationRequest } from "@/utils/server/auth";
import type { AppSessionCredentials } from "@/utils/interface";
import { oauthCookiePrefix } from "@/utils/environment";

export interface SessionEnv {
  Variables: { credentials: AppSessionCredentials };
}

// Forwarding needs provider credentials; Better Auth owns session and refresh.
export function requireAppSession(): MiddlewareHandler<SessionEnv> {
  return async (context, next) => {
    context.header("Cache-Control", "no-store");
    const request = context.req.raw;
    try {
      assertSessionOrigin(request);
    } catch {
      return context.json({ error: "invalid_origin" }, 403);
    }
    try {
      if (!getSessionCookie(request, { cookiePrefix: oauthCookiePrefix }))
        return context.json({ error: "unauthorized" }, 401);
      const record = await rawReadAppCredentials(
        request.headers,
        isMutationRequest(request),
      );
      if (!record) return context.json({ error: "unauthorized" }, 401);
      context.set("credentials", record);
    } catch (error) {
      const failure = classifyAuthError(error, "session");
      return context.json(failure.body, failure.status);
    }
    await next();
  };
}
