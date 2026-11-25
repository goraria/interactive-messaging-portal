import { authUrl } from "@/utils/environment"
import "server-only";
import { getSessionCookie } from "better-auth/cookies";
import type { MiddlewareHandler } from "hono";
import { rawReadAuthenticatedIdentity } from "@/models/session";
import {
  rawGetVerifiedSsoUserInfo,
  rawVerifySsoAccessTokenRequest,
} from "@/services/sso";
import { rawFindUserByExternalId } from "@/models/user";
import { assertSessionOrigin } from "@/lib/auth/config";
import {
  oauthCookiePrefix,
  oauthReadScope,
  oauthWriteScope,
} from "@/utils/environment";
import { formatSsoAuthUser, getAppClaim } from "@/utils/formatter";
import {
  classifyAuthError,
  isLocalUserActive,
  isMutationRequest,
} from "@/utils/server/auth";
import type { ApiEnv, ApiAuthContext } from "@/utils/interface";
import { measureRequest } from "@/utils/server/timing";

interface AuthOptions {
  freshProfile?: boolean;
  // Delegated access-token scopes. Native sessions use local domain permissions.
  requiredBearerScopes?: string[];
}

async function authenticateSession(request: Request, options: AuthOptions) {
  assertSessionOrigin(request);
  if (!getSessionCookie(request, { cookiePrefix: oauthCookiePrefix }))
    return null;
  const identity = await rawReadAuthenticatedIdentity(
    request.headers,
    options.freshProfile ?? false,
  );
  if (!identity) return null;
  return {
    authenticated: true,
    verifiedBy: "better-auth",
    user: {
      id: identity.subject,
      email: identity.user.email,
      name: identity.user.name,
      username: identity.user.username,
      image: identity.user.image,
      status: "active",
    },
    app: null,
    scopes: [],
    sessionId: identity.sid,
    localRole: identity.user.role,
  } satisfies ApiAuthContext;
}

async function authenticateBearer(
  request: Request,
  accessToken: string,
  options: AuthOptions,
) {
  const requiredScopes = options.requiredBearerScopes ?? [
    isMutationRequest(request) ? oauthWriteScope : oauthReadScope,
  ];
  const claims = await rawVerifySsoAccessTokenRequest(
    request,
    requiredScopes,
    accessToken,
    { freshProfile: options.freshProfile },
  );
  const info = await rawGetVerifiedSsoUserInfo(request, accessToken);
  const remote = formatSsoAuthUser(info);
  const local = await rawFindUserByExternalId(claims.sub);
  if (
    !remote ||
    remote.status !== "active" ||
    (local && !isLocalUserActive(local))
  )
    return null;
  return {
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
      getAppClaim(info, new URL("/claims/app", authUrl).href) ??
      getAppClaim(claims, new URL("/claims/app", authUrl).href),
    scopes: (claims.scope ?? "").split(" ").filter(Boolean),
    sessionId: claims.sid ?? null,
    localRole: local?.role ?? null,
  } satisfies ApiAuthContext;
}

export function requireAuth(
  options: AuthOptions = {},
): MiddlewareHandler<ApiEnv> {
  return async (context, next) => {
    try {
      const request = context.req.raw;
      const authorization = request.headers.get("authorization");
      const accessToken = authorization?.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : "";
      // An invalid Authorization header must never fall back to a cookie.
      if (authorization && !accessToken)
        return context.json(
          { error: "missing_app_session_or_access_token" },
          401,
        );
      const auth = await measureRequest("auth", async () =>
        authorization
          ? await authenticateBearer(request, accessToken, options)
          : await authenticateSession(request, options),
      );
      if (!auth)
        return context.json(
          { error: authorization ? "user_not_active" : "unauthorized" },
          authorization ? 403 : 401,
        );
      context.set("auth", auth);
    } catch (error) {
      const failure = classifyAuthError(error);
      if (failure.challenge)
        context.header("WWW-Authenticate", failure.challenge);
      return context.json(failure.body, failure.status);
    }
    // Domain failures keep their own status and never become auth errors.
    await next();
  };
}
