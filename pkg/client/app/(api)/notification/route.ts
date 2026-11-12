import { authorizeProxy } from "@/lib/auth/dal"
import type { NextRequest } from "next/server"

import { notificationCenterServerUrl } from "@/utils/environment"
import { forwardRouteRequest } from "@/services/route"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodyMethods = new Set(["POST", "PUT", "PATCH", "DELETE"])

async function proxyNotificationRequest(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (
    bodyMethods.has(request.method) &&
    origin &&
    origin !== request.nextUrl.origin
  ) {
    return Response.json({ error: "invalid_origin" }, { status: 403 })
  }
  if (!notificationCenterServerUrl) {
    return Response.json(
      { error: "missing_notification_center_server_url" },
      { status: 500 }
    )
  }
  const target = new URL("/notification", notificationCenterServerUrl)
  target.search = request.nextUrl.search
  const headers = new Headers()
  for (const name of [
    "accept",
    "content-type",
    "if-match",
    "if-none-match",
    "idempotency-key",
    "x-request-id",
  ]) {
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

export const GET = proxyNotificationRequest
export const HEAD = proxyNotificationRequest
export const POST = proxyNotificationRequest
export const PUT = proxyNotificationRequest
export const PATCH = proxyNotificationRequest
export const DELETE = proxyNotificationRequest
