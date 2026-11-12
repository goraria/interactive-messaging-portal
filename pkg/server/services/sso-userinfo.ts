import axios from "@gorth/structure/cores/axios"
import { createFetcher } from "@gorth/structure/modules/http"
import {
  AuthError,
  createAuthPolicy,
  fingerprintAuthValue,
} from "@gorth/structure/modules/auth/server"
import { ssoServerUrl } from "@/utils/environment"
import { ssoUserInfoSchema } from "@/schemas/sso"
import type { SsoAccessTokenClaims } from "@/services/sso"

const fetcher = createFetcher(axios)
const maxAge = createAuthPolicy().identityMaxAgeMs
const capacity = 512
// Identity only, never an authorization decision. Each API request still
// verifies JWT/scopes, persistent revocation and local user permissions.
const profiles = new Map<
  string,
  { profile: SsoAccessTokenClaims; expiresAt: number }
>()
const flights = new Map<string, Promise<SsoAccessTokenClaims>>()

export async function getSsoUserInfo(
  accessToken: string,
  options: { fresh?: boolean } = {}
): Promise<SsoAccessTokenClaims> {
  if (!accessToken || accessToken.length > 32768)
    throw new AuthError("rejected")
  const key = await fingerprintAuthValue(accessToken)
  // Share a check already in progress, including concurrent sensitive calls.
  const flight = flights.get(key)
  if (flight) return flight
  const cached = profiles.get(key)
  if (!options.fresh && cached && cached.expiresAt > Date.now())
    return cached.profile
  profiles.delete(key)
  if (flights.size >= capacity) throw new AuthError("unavailable")
  const startedAt = Date.now()
  let operation!: Promise<SsoAccessTokenClaims>
  operation = (async () => {
    // Register the shared flight before invoking a potentially reentrant adapter.
    await Promise.resolve()
    if (!ssoServerUrl) throw new AuthError("invalid_configuration")
    let response
    try {
      response = await fetcher<unknown>({
        url: new URL("/auth/oauth2/userinfo", ssoServerUrl),
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        timeout: 10_000,
        redirect: "error",
        cache: "no-store",
        maxContentLength: 1024 * 1024,
        validateStatus: () => true,
      })
    } catch {
      throw new AuthError("unavailable")
    }
    if (response.status !== 200)
      throw new AuthError(
        response.status === 401 || response.status === 403
          ? "rejected"
          : "unavailable"
      )
    const parsed = ssoUserInfoSchema.safeParse(response.data)
    if (!parsed.success) throw new AuthError("rejected")
    if (parsed.data.status && parsed.data.status !== "active")
      throw new AuthError("forbidden")
    const profile: SsoAccessTokenClaims = Object.freeze(parsed.data)
    // A local grant revoke must fence an older in-flight successful response.
    if (flights.get(key) !== operation) throw new AuthError("rejected")
    for (const [previous, entry] of profiles)
      if (entry.expiresAt <= Date.now()) profiles.delete(previous)
    if (profiles.size >= capacity)
      profiles.delete(profiles.keys().next().value!)
    profiles.set(key, { profile, expiresAt: startedAt + maxAge })
    return profile
  })()
  flights.set(key, operation)
  try {
    return await operation
  } finally {
    if (flights.get(key) === operation) flights.delete(key)
  }
}

export async function forgetSsoUserInfo(accessToken: string) {
  const key = await fingerprintAuthValue(accessToken)
  profiles.delete(key)
  flights.delete(key)
}
