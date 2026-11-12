import "server-only"
import { AuthError } from "@gorth-io/structure/modules/auth/server"
import type { AppSessionCredentials } from "@/utils/interface"
import { isSsoSessionRevoked } from "@/services/revocation"
import { databaseDpopReplayStore } from "@/lib/auth/dpop-replay-store"
import {
  requestToResourceInput,
  verifyAccessTokenRequest,
} from "better-auth/oauth2"

import {
  oauthReadScope,
  oauthWriteScope,
  oauthAudience,
  authUrl,
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
  const baseUrl = authUrl
  if (!baseUrl) throw new Error("missing_auth_url")
  return normalizeUrl(new URL("/auth", baseUrl).toString())
}

function getExpectedAudience() {
  if (!oauthAudience) throw new Error("missing_oauth_audience")
  return new URL(oauthAudience).origin
}

const verifiedProfiles = new WeakMap<globalThis.Request, SsoAccessTokenClaims>()
export async function verifySsoAccessTokenRequest(
  request: globalThis.Request,
  requiredScopes: string[],
  accessToken?: string,
  options: {
    freshProfile?: boolean
    session?: AppSessionCredentials
  } = {}
) {
  const input = requestToResourceInput(request)
  if (!input.authorizationHeader && accessToken)
    input.authorizationHeader = `Bearer ${accessToken}`
  // Resource verification uses the configured issuer and cached remote JWKS;
  // it does not perform another discovery request on every API call.
  const metadata = {
    issuer: getExpectedIssuer(),
    jwks_uri: new URL("/auth/jwks", authUrl).href,
  }
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
  const claims = await verifyAccessTokenRequest(input, {
    jwksUrl: metadata.jwks_uri,
    verifyOptions: {
      issuer: metadata.issuer,
      audience: getExpectedAudience(),
      typ: "at+jwt",
      algorithms: ["RS256", "ES256", "EdDSA"],
      requiredClaims: ["iss", "aud", "sub", "iat", "exp"],
    },
    requiredScopes,
    dpop: { replayStore: databaseDpopReplayStore },
  })
  if (
    typeof claims.sub !== "string" ||
    !claims.sub ||
    (claims.sid !== undefined && typeof claims.sid !== "string")
  )
    throw new AuthError("rejected")
  if (options.session && claims.sid !== options.session.sid)
    throw new AuthError("rejected")
  if (
    await isSsoSessionRevoked({
      subject: claims.sub,
      sid: typeof claims.sid === "string" ? claims.sid : undefined,
      issuedAt: claims.iat! * 1000,
      now: Date.now(),
    })
  )
    throw new AuthError("rejected")
  if (sensitive) await verifyProfile(claims.sub, true)
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
export { verifyBackchannelLogoutToken } from "@/services/revocation"
