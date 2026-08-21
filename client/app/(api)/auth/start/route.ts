import { NextRequest, NextResponse } from "next/server"
import { routes, ssoOAuthClientId } from "@/lib/utils/environment"
import { resolveInternalPath } from "@/lib/utils/formatter"
import {
  createAuthState,
  createOAuthCodeChallenge,
  createOAuthCodeVerifier,
  setAuthIssuerCookie,
  setAuthReturnToCookie,
  setAuthStateCookie,
  setOAuthVerifierCookie,
} from "@/lib/auth/dal"

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode")
  const isSignUp = mode === "sign-up" || mode === "register"
  const returnTo = resolveInternalPath(
    request.nextUrl.searchParams.get("returnTo") ??
    request.nextUrl.searchParams.get("redirect")
  )
  const state = createAuthState()
  const verifier = createOAuthCodeVerifier()
  const redirectUri = new URL("/auth/exchange", request.url)
  const ssoOrigin = new URL(isSignUp ? routes.register : routes.login).origin
  const expectedIssuer = new URL("/auth", ssoOrigin).toString()
  const authorizeUrl = new URL("/auth/oauth2/authorize", ssoOrigin)

  authorizeUrl.searchParams.set("response_type", "code")
  authorizeUrl.searchParams.set("client_id", ssoOAuthClientId)
  authorizeUrl.searchParams.set("redirect_uri", redirectUri.toString())
  authorizeUrl.searchParams.set("scope", "openid profile email offline_access")
  authorizeUrl.searchParams.set("state", state)
  authorizeUrl.searchParams.set(
    "code_challenge",
    createOAuthCodeChallenge(verifier)
  )
  authorizeUrl.searchParams.set("code_challenge_method", "S256")
  authorizeUrl.searchParams.set("resource", request.nextUrl.origin)
  if (isSignUp) {
    authorizeUrl.searchParams.set("prompt", "create")
  }

  const response = NextResponse.redirect(authorizeUrl)
  response.headers.set("Cache-Control", "no-store")
  setAuthStateCookie(response, state)
  setOAuthVerifierCookie(response, verifier)
  setAuthReturnToCookie(response, returnTo)
  setAuthIssuerCookie(response, expectedIssuer)

  return response
}
