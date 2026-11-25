import { Hono } from "hono"
import * as auth from "@/app/(api)/auth/[[...route]]/route"
import * as sync from "@/app/(api)/auth/sync/route"
import * as backchannel from "@/app/(api)/auth/sign-out/back-channel/route"
import * as internal from "@/app/(api)/internal/[[...route]]/route"
import * as external from "@/app/(api)/external/[[...route]]/route"
import { formatApiPath } from "@/utils/formatter"
import * as health from "@/app/(api)/health/route"
import * as metadata from "@/app/(api)/.well-known/oauth-protected-resource/route"
import * as credential from "@/app/(api)/internal/storage/credential/route"
import * as dispatch from "@/app/(api)/event/dispatch/route"

type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS"
type RouteHandler = (request: Request) => Response | Promise<Response>

const dedicatedRoutes: Record<string, Partial<Record<HttpMethod, RouteHandler>>> = {
  "/health": health,
  "/.well-known/oauth-protected-resource": metadata,
  "/internal/storage/credential": credential,
  "/event/dispatch": dispatch,
}

export function routeRequest(request: Request) {
  const url = new URL(request.url)
  const original = url.pathname
  const dedicated = dedicatedRoutes[original]
  if (dedicated)
    return dedicated[request.method as HttpMethod]?.(request) ?? new Response(null, { status: 405 })
  url.pathname = formatApiPath(original)
  const namespace = url.pathname.split("/")[1]
  const route =
    original === "/auth/sync"
      ? sync
      : original === "/auth/sign-out/back-channel"
        ? backchannel
        : namespace === "auth"
          ? auth
          : namespace === "external"
            ? external
            : internal
  const fn = route[request.method as "GET"]
  const forwarded = url.pathname === original ? request : new Request(url, request)
  return fn(forwarded)
}

export function createApp() {
  const app = new Hono()
  app.all("*", (context) => routeRequest(context.req.raw))
  return app
}
