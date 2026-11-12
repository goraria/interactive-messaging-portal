import "server-only"
import { oauthCookiePrefix } from "@/utils/environment"
import {
  AuthError,
  assertMutationOrigin,
} from "@gorth-io/structure/modules/auth/server"
import {
  appUrl,
  oauthAudience,
  authUrl,
  oauthClientId,
  sessionSecret,
  oauthNotifyAudience,
  oauthResourceAudience,
  oauthDiscoveryAudience,
  oauthPaymentAudience,
  oauthBillingAudience,
  oauthMediaAudience,
  oauthInsightAudience,
} from "@/utils/environment"

export function getAuthConfig() {
  if (!/^[A-Za-z0-9_.-]+$/.test(oauthCookiePrefix))
    throw new Error("NEXT_OAUTH_COOKIE_PREFIX must be a non-empty cookie prefix");
  const missingVariables = Object.entries({
    NEXT_PUBLIC_APP_URL: appUrl,
    NEXT_PUBLIC_AUTH_URL: authUrl,
    NEXT_PUBLIC_OAUTH_CLIENT_ID: oauthClientId,
    NEXT_OAUTH_AUDIENCE: oauthAudience,
    NEXT_SESSION_SECRET: sessionSecret,
  })
    .filter(([, value]) => !value)
    .map(([name]) => name)
  if (missingVariables.length || Buffer.byteLength(sessionSecret) < 32) {
    console.error("[auth/config]", {
      missingVariables,
      invalidVariables:
        sessionSecret && Buffer.byteLength(sessionSecret) < 32
          ? ["NEXT_SESSION_SECRET"]
          : [],
    })
    throw new AuthError("invalid_configuration")
  }
  function origin(value: string) {
    const url = new URL(value)
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    if (
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    )
      throw new AuthError("invalid_configuration")
    return url.origin
  }
  const appOrigin = origin(appUrl),
    ssoOrigin = origin(authUrl)
  return {
    origin: appOrigin,
    ssoOrigin,
    issuer: ssoOrigin + "/auth",
    clientId: oauthClientId,
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
        ]
          .filter(Boolean)
          .map(origin)
      ),
    ],
  }
}
export function assertSameOrigin(request: Request) {
  assertMutationOrigin(request.headers, [getAuthConfig().origin])
}
export function assertSessionReadOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (
    (origin && origin !== getAuthConfig().origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new AuthError("forbidden")
}
