import { createHash } from "node:crypto"
import {
  AuthError,
  assertMutationOrigin,
  createAuthCipher,
} from "@gorth/structure/modules/auth/server"
import {
  clientUrl,
  serverUrl,
  ssoClientUrl,
  ssoServerUrl,
  ssoOAuthClientId,
  sessionSecret,
  isProduction,
  oauthResources,
} from "@/utils/environment"
export function getAuthConfig() {
  if (
    !clientUrl ||
    !ssoClientUrl ||
    !ssoServerUrl ||
    !ssoOAuthClientId ||
    !sessionSecret ||
    Buffer.byteLength(sessionSecret) < 32
  )
    throw new AuthError("invalid_configuration")
  const origins = [clientUrl, ssoClientUrl, ssoServerUrl].map((value) => {
    const url = new URL(value)
    if (
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      (url.protocol !== "https:" &&
        (isProduction ||
          url.protocol !== "http:" ||
          !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    )
      throw new AuthError("invalid_configuration")
    return url.origin
  })
  const [origin, ssoOrigin, serverOrigin] = origins as [string, string, string]
  return {
    origin,
    ssoOrigin,
    serverOrigin,
    issuer: ssoOrigin + "/auth",
    clientId: ssoOAuthClientId,
    redirectUri: origin + "/auth/exchange",
    scopes: [
      "openid",
      "profile",
      "email",
      "offline_access",
      "chat:read",
      "chat:write",
    ],
    // Audience allowlist is backend-owned, never accepted from browser/RPC input.
    resources: [
      ...new Set(
        [serverUrl, ...oauthResources.split(/\s+/).filter(Boolean)].map(
          (value) => {
            const url = new URL(value)
            if (
              url.username ||
              url.password ||
              url.search ||
              url.hash ||
              url.pathname !== "/" ||
              (url.protocol !== "https:" &&
                (isProduction ||
                  url.protocol !== "http:" ||
                  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
            )
              throw new AuthError("invalid_configuration")
            return url.origin
          }
        )
      ),
    ],
  }
}
function cipher() {
  return createAuthCipher({
    key: createHash("sha256")
      .update("gorth-chat-session:" + sessionSecret)
      .digest(),
    audience: getAuthConfig().clientId,
  })
}
export const sealAuthData = (
  value: Record<string, unknown>,
  purpose: "credentials" | "transaction",
  expiresAt: Date
) => cipher().seal(value, purpose, expiresAt.getTime())
export const openAuthData = (
  value: string,
  purpose: "credentials" | "transaction"
) => cipher().open(value, purpose)
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
