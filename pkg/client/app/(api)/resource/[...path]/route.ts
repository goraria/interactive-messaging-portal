import { authorizeProxy } from "@/lib/auth/dal"
import type { NextRequest } from "next/server"

import { resourceInteractionServerUrl } from "@/utils/environment"
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

function hasValidOrigin(request: NextRequest) {
  const origin = request.headers.get("origin")
  return !origin || origin === request.nextUrl.origin
}

async function proxyResourceRequest(
  request: NextRequest,
  context: RouteContext
) {
  if (bodyMethods.has(request.method) && !hasValidOrigin(request)) {
    return Response.json({ error: "invalid_origin" }, { status: 403 })
  }

  if (!resourceInteractionServerUrl) {
    return Response.json(
      { error: "missing_resource_interaction_server_url" },
      { status: 500 }
    )
  }

  const { path } = await context.params
  const target = new URL(
    `/resource/${path.map((segment) => encodeURIComponent(segment)).join("/")}`,
    resourceInteractionServerUrl
  )
  target.search = request.nextUrl.search

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

export const GET = proxyResourceRequest
export const HEAD = proxyResourceRequest
export const POST = proxyResourceRequest
export const PUT = proxyResourceRequest
export const PATCH = proxyResourceRequest
export const DELETE = proxyResourceRequest
