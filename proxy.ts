import { appUrl, oauthCookiePrefix, vercelDeployment, websocketPort } from "@/utils/environment"
import { resolveWebsocketListenerPort } from "@/utils/realtime-port"
import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"
import { publicPrefixes } from "@/utils/navigation"

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  // Only these two socket paths reach the existing Hono listener.
  if (
    pathname === "/chat/realtime/call/socket" ||
    /^\/chat\/conversation\/[^/]+\/realtime\/socket$/.test(pathname)
  ) {
    // Vercel upgrades in the concrete Route Handler, never via loopback.
    if (vercelDeployment) return NextResponse.next()
    const port = resolveWebsocketListenerPort(websocketPort, appUrl)
    return NextResponse.rewrite(new URL(pathname, `http://127.0.0.1:${port}`))
  }
  const navigation =
    request.headers.get("sec-fetch-mode") === "navigate" ||
    request.headers.get("accept")?.includes("text/html") ||
    request.headers.has("rsc")
  if (!navigation) return NextResponse.next()
  const publicRoute =
    pathname === "/" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/.well-known/") ||
    publicPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
    )
  if (
    !publicRoute &&
    !getSessionCookie(request, { cookiePrefix: oauthCookiePrefix })
  )
    return NextResponse.redirect(new URL("/", request.url))
  // Optimistic cookie gate only; native sessions + local policy authorize APIs.
  return NextResponse.next()
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
