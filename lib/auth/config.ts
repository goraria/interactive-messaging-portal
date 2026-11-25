import "server-only";
import { oauthCookiePrefix } from "@/utils/environment";
import { isMutationRequest } from "@/utils/server/auth";
import {
  AuthError,
  assertMutationOrigin,
} from "@gorth-com/structure/modules/auth/server";
import {
  appUrl,
  oauthAudience,
  authUrl,
  oauthClientId,
  oauthClientSecret,
  sessionSecret,
  oauthNotifyAudience,
  oauthResourceAudience,
  oauthDiscoveryAudience,
  oauthPaymentAudience,
  oauthBillingAudience,
  oauthMediaAudience,
  oauthInsightAudience,
  oauthCommerceAudience,
} from "@/utils/environment";

export function getAuthConfig() {
  if (!/^[A-Za-z0-9_.-]+$/.test(oauthCookiePrefix))
    throw new Error(
      "NEXT_OAUTH_COOKIE_PREFIX must be a non-empty cookie prefix",
    );
  const missingVariables = Object.entries({
    NEXT_PUBLIC_APP_URL: appUrl,
    NEXT_PUBLIC_AUTH_URL: authUrl,
    NEXT_OAUTH_CLIENT_ID: oauthClientId,
    NEXT_OAUTH_CLIENT_SECRET: oauthClientSecret,
    NEXT_OAUTH_AUDIENCE: oauthAudience,
    NEXT_SESSION_SECRET: sessionSecret,
  })
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missingVariables.length || Buffer.byteLength(sessionSecret) < 32) {
    console.error("[auth/config]", {
      missingVariables,
      invalidVariables:
        sessionSecret && Buffer.byteLength(sessionSecret) < 32
          ? ["NEXT_SESSION_SECRET"]
          : [],
    });
    throw new AuthError("invalid_configuration");
  }
  function origin(value: string) {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    )
      throw new AuthError("invalid_configuration");
    return url.origin;
  }
  const appOrigin = origin(appUrl),
    ssoOrigin = origin(authUrl);
  return {
    origin: appOrigin,
    ssoOrigin,
    issuer: ssoOrigin + "/auth",
    clientId: oauthClientId,
    clientSecret: oauthClientSecret,
    secret: sessionSecret,
    redirectUri: appOrigin + "/auth/callback/gorth",
    resources: [
      ...new Set(
        [
          oauthAudience,
          oauthNotifyAudience,
          oauthResourceAudience,
          oauthDiscoveryAudience,
          oauthPaymentAudience,
          oauthBillingAudience,
          oauthMediaAudience,
          oauthInsightAudience,
          oauthCommerceAudience,
        ]
          .filter(Boolean)
          .map(origin),
      ),
    ],
  };
}
export function assertSameOrigin(request: Request) {
  assertMutationOrigin(request.headers, [getAuthConfig().origin]);
}
export function assertSessionOrigin(request: Request) {
  if (isMutationRequest(request)) assertSameOrigin(request);
  else assertSessionReadOrigin(request);
}
export function assertSessionReadOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (
    (origin && origin !== getAuthConfig().origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new AuthError("forbidden");
}
