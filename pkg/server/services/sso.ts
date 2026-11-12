import {
  AuthError,
  createResourceAuth,
  type SessionCredentials,
} from "@gorth/structure/modules/auth/server"
import type { AuthAccount } from "@/lib/auth/store"
import { getAuthRuntime } from "@/lib/auth/runtime"
import { requestToResourceInput } from "better-auth/oauth2"

import {
  oauthReadScope,
  oauthWriteScope,
  serverUrl,
  ssoClientUrl,
  isProduction,
} from "@/utils/environment"
import { normalizeUrl } from "@/utils/formatter"
import { getSsoUserInfo } from "@/services/sso-userinfo"
export { getSsoUserInfo } from "@/services/sso-userinfo"

export function getOAuthProtectedResourceMetadata() {
  return {
    resource: getExpectedAudience(),
    authorization_servers: [getExpectedIssuer()],
    scopes_supported: [oauthReadScope, oauthWriteScope],
    bearer_methods_supported: ["header"],
  }
}

export interface SsoAccessTokenClaims {
  iss?: string
  sub: string
  sid?: string
  aud?: string | string[]
  exp?: number
  nbf?: number
  scope?: string
  email?: string
  name?: string | null
  preferred_username?: string | null
  status?: "active" | "inactive" | "suspended" | "deleted"
  picture?: string | null
  user_metadata?: Record<string, unknown>
  gorth_app?: Record<string, unknown>
  [key: string]: unknown
}

function getExpectedIssuer() {
  const baseUrl = ssoClientUrl
  if (!baseUrl) throw new Error("missing_sso_client_url")
  return normalizeUrl(new URL("/auth", baseUrl).toString())
}

function getExpectedAudience() {
  if (!serverUrl) throw new Error("missing_server_url")
  return new URL(serverUrl).origin
}

const verifiedProfiles = new WeakMap<globalThis.Request, SsoAccessTokenClaims>()
export async function verifySsoAccessTokenRequest(
  request: globalThis.Request,
  requiredScopes: string[],
  accessToken?: string,
  options: {
    freshProfile?: boolean
    session?: SessionCredentials<AuthAccount>
  } = {}
) {
  const input = requestToResourceInput(request)
  if (!input.authorizationHeader && accessToken)
    input.authorizationHeader = `Bearer ${accessToken}`
  const runtime = getAuthRuntime()
  // Share the bounded, coalesced Structure discovery snapshot already used by
  // OAuth login/refresh instead of a second independent discovery request.
  const metadata = await runtime.discovery.metadata()
  const sensitive =
    Boolean(options.freshProfile) ||
    !["GET", "HEAD", "OPTIONS"].includes(request.method)
  async function verifyProfile(subject: string, fresh: boolean) {
    const authorization = input.authorizationHeader ?? ""
    const token = authorization.replace(/^(Bearer|DPoP) /, "")
    // Hono's cookie branch has already checked the DB, local policy and SSO
    // freshness. Reuse that verified identity, not a second online request.
    const session = options.session
    if (
      session &&
      (session.subject !== subject || session.credentials.accessToken !== token)
    )
      throw new AuthError("rejected")
    const profile: SsoAccessTokenClaims = session
      ? {
          sub: session.subject,
          email: session.user.email,
          name: session.user.name,
          preferred_username: session.user.username,
          picture: session.user.image,
          status: session.user.status as SsoAccessTokenClaims["status"],
        }
      : await getSsoUserInfo(token, { fresh })
    if (profile.sub !== subject) throw new AuthError("rejected")
    if (profile.status && profile.status !== "active")
      throw new AuthError("forbidden")
    verifiedProfiles.set(request, profile)
  }
  const resource = createResourceAuth({
    verification: {
      jwksUrl: metadata.jwks_uri,
      verifyOptions: {
        issuer: metadata.issuer,
        audience: getExpectedAudience(),
      },
      requiredScopes,
    },
    proof: runtime.store.proof,
    revocation: runtime.store.revocation,
    policy: runtime.policy,
    onlineVerification: "sensitive",
    allowLoopbackHttp: !isProduction,
    async verifyActive(claims) {
      await verifyProfile(claims.sub!, true)
    },
  })
  const claims = await resource.verify(input, { sensitive })
  // Bound missed-event/status freshness even on routine reads. This cache is
  // checked only AFTER token verification and the durable revocation lookup.
  if (!sensitive) await verifyProfile(claims.sub!, false)
  return claims as SsoAccessTokenClaims
}
export async function getVerifiedSsoUserInfo(
  request: globalThis.Request,
  accessToken: string
) {
  return verifiedProfiles.get(request) ?? getSsoUserInfo(accessToken)
}
export const verifyBackchannelLogoutToken = (token: string) =>
  getAuthRuntime().logout.verify(token)
