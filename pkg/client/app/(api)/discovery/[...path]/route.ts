import { authorizeProxy } from "@/lib/auth/dal"
import type { NextRequest } from "next/server"

import { discoveryEngineServerUrl } from "@/utils/environment"
import { forwardRouteRequest } from "@/services/route"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ path: string[] }>
}

const bodyMethods = new Set(["POST", "PUT", "PATCH", "DELETE"])
const forwardedHeaders = [
  "accept",
  "content-type",
  "if-match",
  "if-none-match",
  "idempotency-key",
  "x-request-id",
] as const

async function proxyDiscoveryRequest(
  request: NextRequest,
  context: RouteContext
) {
  const origin = request.headers.get("origin")
  if (
    bodyMethods.has(request.method) &&
    origin &&
    origin !== request.nextUrl.origin
  ) {
    return Response.json({ error: "invalid_origin" }, { status: 403 })
  }
  if (!discoveryEngineServerUrl) {
    return Response.json(
      { error: "missing_discovery_server_url" },
      { status: 503 }
    )
  }
  const { path } = await context.params
  const target = new URL(
    `/discovery/${path.map((segment) => encodeURIComponent(segment)).join("/")}`,
    discoveryEngineServerUrl
  )
  target.search = request.nextUrl.search
  if (request.method === "GET" || request.method === "HEAD") {
    target.searchParams.set("application", "chat")
  }
  const headers = new Headers()
  for (const name of forwardedHeaders) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  const authorization = await authorizeProxy(request)
  if (authorization.response) return authorization.response
  const accessToken = authorization.token
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`)
  return forwardRouteRequest({
    authCookies: authorization.cookies,
    url: target,
    method: request.method,
    headers,
    body: bodyMethods.has(request.method)
      ? await request.arrayBuffer()
      : undefined,
  })
}

export const GET = proxyDiscoveryRequest
export const HEAD = proxyDiscoveryRequest
export const POST = proxyDiscoveryRequest
export const PUT = proxyDiscoveryRequest
export const PATCH = proxyDiscoveryRequest
export const DELETE = proxyDiscoveryRequest
