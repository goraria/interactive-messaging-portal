import "server-only"

import { apiBaseUrl, ssoServerUrl } from "@/lib/utils/environment"
import {
  fetcher,
  toWebResponse,
  type FetcherOptions,
} from "@/lib/utils/fetcher"
export interface ForwardRoomMessagesRequest {
  url: URL
  method: "GET" | "POST"
  accessToken: string
  body?: string
}

interface ForwardAuthenticatedRouteRequest {
  path: string
  accessToken: string
}

function requireUrl(value: string | undefined, name: string) {
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function getSsoServerBaseUrl() {
  return requireUrl(ssoServerUrl, "NEXT_SSO_SERVER_URL")
}

function getAppServerBaseUrl() {
  return requireUrl(apiBaseUrl, "NEXT_PUBLIC_API_BASE_URL")
}

export function getRouteOpenIdConfiguration<TData>(issuer: string) {
  return fetcher<TData>({
    url: `${issuer}/.well-known/openid-configuration`,
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    validateStatus: () => true,
  })
}

export function getRouteJwks<TData>(jwksUri: string) {
  return fetcher<TData>({
    url: jwksUri,
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    validateStatus: () => true,
  })
}

export function exchangeRouteAuthorizationCode<TData>(body: URLSearchParams) {
  return fetcher<TData, URLSearchParams>({
    url: new URL("/auth/oauth2/token", getSsoServerBaseUrl()),
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    cache: "no-store",
    validateStatus: () => true,
  })
}

export function syncRouteAppUser(accessToken: string) {
  return fetcher({
    url: new URL("/auth/sync-user", getAppServerBaseUrl()),
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
    validateStatus: () => true,
  })
}

export function getRouteOAuthUserInfo<TData>(accessToken: string) {
  return fetcher<TData>({
    url: new URL("/auth/oauth2/userinfo", getSsoServerBaseUrl()),
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
    validateStatus: () => true,
  })
}

export function refreshRouteOAuthToken<TData>(body: URLSearchParams) {
  return fetcher<TData, URLSearchParams>({
    url: new URL("/auth/oauth2/token", getSsoServerBaseUrl()),
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    cache: "no-store",
    validateStatus: () => true,
  })
}

export function revokeRouteOAuthToken(body: URLSearchParams) {
  return fetcher({
    url: new URL("/auth/oauth2/revoke", getSsoServerBaseUrl()),
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    cache: "no-store",
    validateStatus: () => true,
  })
}

export async function forwardRoomMessagesRoute({
  url,
  method,
  accessToken,
  body,
}: ForwardRoomMessagesRequest) {
  const target = new URL(url.pathname, getAppServerBaseUrl())
  target.search = url.search

  const response = await fetcher<ArrayBuffer, string | undefined>({
    url: target,
    method,
    body,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    responseType: "arraybuffer",
    validateStatus: () => true,
  })

  return toWebResponse(response)
}

export function forwardAuthenticatedRoute({
  path,
  accessToken,
}: ForwardAuthenticatedRouteRequest) {
  return fetcher<{ data?: unknown; error?: string }>({
    url: new URL(path, getAppServerBaseUrl()),
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    validateStatus: () => true,
  })
}
