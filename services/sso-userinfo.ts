import "server-only"
import axios from "@gorth-io/structure/cores/axios"
import { createFetcher } from "@gorth-io/structure/modules/http"
import {
  AuthError,
  createAuthPolicy,
  createUserInfoCache,
  type IdentityCacheInput,
} from "@gorth-io/structure/modules/auth/server"
import { authUrl } from "@/utils/environment"
import { ssoUserInfoSchema } from "@/schemas/sso"
import type { SsoAccessTokenClaims } from "@/services/sso"

const fetcher = createFetcher(axios)

// Structure owns bounded caching, coalescing and logout fences. This adapter
// owns the SSO endpoint and profile validation, never an authorization decision.
const profiles = createUserInfoCache<SsoAccessTokenClaims>({
  maxAgeMs: createAuthPolicy().identityMaxAgeMs,
  capacity: 512,
  now: () => Date.now(),
  parse: (value) => ssoUserInfoSchema.parse(value),
  allowed: (profile) => !profile.status || profile.status === "active",
  async load(accessToken) {
    if (!authUrl) throw new AuthError("invalid_configuration")
    let response
    try {
      response = await fetcher<unknown>({
        url: new URL("/auth/oauth2/userinfo", authUrl),
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
    return response.data
  },
})

export async function getSsoUserInfo(
  accessToken: string,
  options: IdentityCacheInput = {}
): Promise<SsoAccessTokenClaims> {
  return await profiles.get(accessToken, options)
}

export async function forgetSsoUserInfo(accessToken: string) {
  await profiles.forget(accessToken)
}
