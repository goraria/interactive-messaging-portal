import { NextResponse } from "next/server"
import { routes, serverUrl } from "@/utils/environment"

export const runtime = "nodejs"

function getSsoIssuer() {
  return new URL("/auth", new URL(routes.login).origin)
    .toString()
    .replace(/\/$/, "")
}

export async function GET() {
  return NextResponse.json(
    {
      resource: new URL(serverUrl).origin,
      authorization_servers: [getSsoIssuer()],
      scopes_supported: ["chat:read", "chat:write"],
      bearer_methods_supported: ["header"],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    }
  )
}
