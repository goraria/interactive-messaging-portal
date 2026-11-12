import "server-only"
import {
  clientCredentialsTokenRequest,
  requestToResourceInput,
  verifyAccessTokenRequest,
  isInsufficientScopeError,
} from "better-auth/oauth2"
import { chatGrantSchema } from "@/schemas/chat-platform"
import { fetcher } from "@/utils/fetcher"
import * as environment from "@/utils/environment"
import { createServiceError } from "@/utils/service"

const registry = {
  notification: environment.oauthNotifyAudience,
  resource: environment.oauthResourceAudience,
  discovery: environment.oauthDiscoveryAudience,
  media: environment.oauthMediaAudience,
  insight: environment.oauthInsightAudience,
}
const machineScopes = {
  notification: "chat:notification:publish",
  discovery: "chat:discovery:write",
  media: "chat:media:delegate",
  insight: "chat:insight:publish",
  chat: "chat:dispatch",
}
const grants = new Map<string, { token: string; expires: number }>()
const inflight = new Map<string, Promise<string>>()
export function trustedChatOrigin(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw createServiceError(503, "platform_not_configured")
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      (environment.isProduction ||
        url.protocol !== "http:" ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
  )
    throw createServiceError(503, "invalid_platform_origin")
  return url.origin
}
export async function chatBackendToken(domain: keyof typeof machineScopes) {
  const existing = grants.get(domain)
  if (existing && existing.expires > Date.now() + 30000) return existing.token
  if (inflight.has(domain)) return inflight.get(domain)!
  const request = (async () => {
    try {
      const method = environment.oauthTokenEndpointAuthMethod
      if (
        !environment.serverOauthClientId ||
        !environment.serverOauthClientSecret ||
        !["client_secret_basic", "client_secret_post"].includes(method)
      )
        throw new Error()
      const endpoint = new URL(
        "/auth/oauth2/token",
        trustedChatOrigin(environment.authUrl)
      ).href
      const input = await clientCredentialsTokenRequest({
        options: {
          clientId: environment.serverOauthClientId,
          clientSecret: environment.serverOauthClientSecret,
        },
        tokenEndpoint: endpoint,
        tokenEndpointAuth: {
          method: method as "client_secret_basic" | "client_secret_post",
        },
        scope: machineScopes[domain],
        resource: trustedChatOrigin(
          domain === "chat" ? environment.oauthAudience : registry[domain]
        ),
      })
      const result = await fetcher({
        url: endpoint,
        method: "POST",
        headers: input.headers,
        body: input.body,
        redirect: "error",
        cache: "no-store",
        timeout: 10000,
      })
      const grant = chatGrantSchema.parse(result.data)
      grants.set(domain, {
        token: grant.access_token,
        expires: Date.now() + grant.expires_in * 1000,
      })
      return grant.access_token
    } catch {
      throw createServiceError(503, "backend_grant_unavailable")
    }
  })()
  inflight.set(domain, request)
  try {
    return await request
  } finally {
    inflight.delete(domain)
  }
}
export async function chatPlatformRequest<T>(
  domain: keyof typeof registry,
  path: string,
  method: "GET" | "POST" | "DELETE",
  body?: unknown,
  userToken?: string
): Promise<T> {
  const origin = trustedChatOrigin(registry[domain])
  const target = new URL(origin)
  if (
    !path.startsWith("/" + domain + "/") ||
    path.includes("?") ||
    path.includes("#")
  )
    throw createServiceError(400, "invalid_platform_path")
  target.pathname = path
  if (!target.pathname.startsWith("/" + domain + "/"))
    throw createServiceError(400, "invalid_platform_path")
  let token = userToken
  if (!token) {
    if (domain === "resource")
      throw createServiceError(403, "delegated_user_token_required")
    token = await chatBackendToken(domain)
  }
  const result = await fetcher<T>({
    url: target,
    method,
    body,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    redirect: "error",
    cache: "no-store",
    timeout: 10000,
    validateStatus: () => true,
  })
  if (result.status === 401 && !userToken) grants.delete(domain)
  if (result.status < 200 || result.status >= 300)
    throw createServiceError(
      result.status >= 500 ? 503 : result.status,
      "platform_request_failed"
    )
  return result.data
}
export async function verifyChatBackend(request: Request, storage = false) {
  if (
    ["cookie", "origin", "sec-fetch-site"].some((name) =>
      request.headers.has(name)
    )
  )
    throw createServiceError(403, "machine_request_required")
  const auth = trustedChatOrigin(environment.authUrl)
  const scope = storage ? "storage:chat:credential" : "chat:dispatch"
  const maxAge = storage ? 120 : 600
  const audience = storage
    ? new URL(
        "/internal/storage/credential",
        trustedChatOrigin(environment.appUrl)
      ).href
    : trustedChatOrigin(environment.oauthAudience)
  const input = requestToResourceInput(request)
  if (
    !input.authorizationHeader ||
    !/^Bearer [^\s]+$/i.test(input.authorizationHeader)
  )
    throw createServiceError(401, "missing_machine_grant")
  input.authorizationHeader = "Bearer " + input.authorizationHeader.slice(7)
  try {
    const claims = await verifyAccessTokenRequest(input, {
      jwksUrl: new URL("/auth/jwks", auth).href,
      requiredScopes: [scope],
      verifyOptions: {
        issuer: new URL("/auth", auth).href,
        audience,
        typ: "at+jwt",
        algorithms: ["RS256", "ES256", "EdDSA"],
        requiredClaims: ["iss", "aud", "sub", "client_id", "iat", "exp"],
        maxTokenAge: maxAge,
      },
    })
    if (
      typeof claims.client_id !== "string" ||
      !claims.client_id ||
      claims.sub !== claims.client_id ||
      claims.sid !== undefined ||
      typeof claims.iat !== "number" ||
      typeof claims.exp !== "number" ||
      claims.exp <= claims.iat ||
      claims.exp - claims.iat > maxAge ||
      (claims.status !== undefined && claims.status !== "active")
    )
      throw createServiceError(403, "forbidden_machine_grant")
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error
    if (isInsufficientScopeError(error))
      throw createServiceError(403, "insufficient_scope")
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : ""
    throw createServiceError(
      /^(ERR_JWT|ERR_JWS|ERR_JOSE|ERR_JWKS_NO_MATCHING_KEY)/.test(code)
        ? 401
        : 503,
      "machine_verification_failed"
    )
  }
}
