import {
  appUrl,
  oauthCookiePrefix,
  vercelDeployment,
  websocketPort,
} from "@/utils/environment";
import { resolveWebsocketListenerPort } from "@/utils/realtime-port";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // Only these two socket paths reach the existing Hono listener.
  if (/^\/external\/socket\/[^/]+\/(chat|call)$/.test(pathname)) {
    // Vercel upgrades through the catch-all Route Handler, never via loopback.
    if (vercelDeployment) return NextResponse.next();
    const port = resolveWebsocketListenerPort(websocketPort, appUrl);
    return NextResponse.rewrite(new URL(pathname, `http://127.0.0.1:${port}`));
  }
  if (/^\/(internal|external)(\/|$)/.test(pathname))
    return NextResponse.next();
  const navigation =
    request.headers.get("sec-fetch-mode") === "navigate" ||
    request.headers.get("accept")?.includes("text/html") ||
    request.headers.has("rsc");
  // Only page navigation receives optimistic redirects. APIs always reach
  // Hono's authoritative session/Bearer and resource permission checks,
  // even when a caller sends text/html or RSC headers.
  const protectedPage =
    pathname === "/billing" ||
    ["/chat", "/account", "/setting"].some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
    );
  if (!navigation || !protectedPage) return NextResponse.next();
  if (!getSessionCookie(request, { cookiePrefix: oauthCookiePrefix }))
    return NextResponse.redirect(new URL("/", request.url));
  // Optimistic cookie gate only; native sessions + local policy authorize APIs.
  return NextResponse.next();
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
