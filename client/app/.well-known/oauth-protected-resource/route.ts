import { NextRequest, NextResponse } from "next/server"
import { routes, ssoOAuthClientId } from "@/lib/environment"

export const runtime = "nodejs"

function getSsoIssuer() {
  return new URL("/auth", new URL(routes.login).origin)
    .toString()
    .replace(/\/$/, "")
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      resource: request.nextUrl.origin,
      authorization_servers: [getSsoIssuer()],
      scopes_supported: ["openid", "profile", "email", "offline_access"],
      bearer_methods_supported: ["header"],
      client_id: ssoOAuthClientId,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    }
  )
}
