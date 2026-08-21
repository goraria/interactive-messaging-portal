import { NextRequest, NextResponse } from "next/server"

import type { SsoExchangeResponse } from "@/lib/utils/interface"

export const runtime = "nodejs"

const ssoServerUrl =
  process.env.SSO_SERVER_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.BETTER_AUTH_URL

function getServerBaseUrl() {
  if (!ssoServerUrl) {
    throw new Error("Missing SSO_SERVER_INTERNAL_URL")
  }

  return ssoServerUrl
}

async function getBody(request: NextRequest) {
  try {
    return (await request.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function POST(request: NextRequest) {
  const body = await getBody(request)
  const response = await fetch(
    new URL("/internal/sso/verify-token", getServerBaseUrl()),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SSO_CLIENT_INTERNAL_SECRET
          ? { "x-sso-client-secret": process.env.SSO_CLIENT_INTERNAL_SECRET }
          : {}),
      },
      body: JSON.stringify({
        access_token:
          typeof body.access_token === "string" ? body.access_token : "",
        refresh_token:
          typeof body.refresh_token === "string" ? body.refresh_token : "",
        app: body.app && typeof body.app === "object" ? body.app : undefined,
      }),
      cache: "no-store",
    }
  )

  if (!response.ok) {
    return NextResponse.json(
      { error: response.status === 401 ? "invalid_token" : "verify_failed" },
      {
        status: response.status,
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      }
    )
  }

  const payload = (await response.json()) as SsoExchangeResponse

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  })
}
