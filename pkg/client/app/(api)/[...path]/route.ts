import type { NextRequest } from "next/server"

import { serverUrl, sessionAppCookie } from "@/utils/environment"
import { forwardRouteRequest } from "@/services/route"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface ProxyContext {
  params: Promise<{ path: string[] }>
}

const requestBodyMethods = new Set(["POST", "PUT", "PATCH", "DELETE"])
const forwardedRequestHeaders = [
  "accept",
  "content-type",
  "if-match",
  "if-none-match",
  "if-modified-since",
  "range",
  "idempotency-key",
  "x-request-id",
  "origin",
  "sec-fetch-site",
] as const

async function proxyResourceRequest(
  request: NextRequest,
  context: ProxyContext
) {
  if (!serverUrl) {
    return Response.json({ error: "missing_app_server_url" }, { status: 500 })
  }

  const { path } = await context.params
  const endpoint = new URL(
    `/${path.map(encodeURIComponent).join("/")}`,
    serverUrl
  )
  endpoint.search = request.nextUrl.search

  const headers = new Headers()
  // This fallback transports HTTP only. Hono owns authorization, including
  // private /lab routes; do not turn the cookie into a bearer grant in Next.
  const appCookies = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(sessionAppCookie + "="))
  if (appCookies.length) headers.set("cookie", appCookies.join("; "))
  for (const name of forwardedRequestHeaders) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  return forwardRouteRequest({
    url: endpoint,
    method: request.method,
    headers,
    body: requestBodyMethods.has(request.method)
      ? await request.arrayBuffer()
      : undefined,
  })
}

export function GET(request: NextRequest, context: ProxyContext) {
  return proxyResourceRequest(request, context)
}

export function HEAD(request: NextRequest, context: ProxyContext) {
  return proxyResourceRequest(request, context)
}

export function POST(request: NextRequest, context: ProxyContext) {
  return proxyResourceRequest(request, context)
}

export function PUT(request: NextRequest, context: ProxyContext) {
  return proxyResourceRequest(request, context)
}

export function PATCH(request: NextRequest, context: ProxyContext) {
  return proxyResourceRequest(request, context)
}

export function DELETE(request: NextRequest, context: ProxyContext) {
  return proxyResourceRequest(request, context)
}
