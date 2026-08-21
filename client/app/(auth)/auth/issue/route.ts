import { NextResponse } from "next/server"

function legacyDisabledResponse() {
  return NextResponse.json(
    {
      error: "legacy_sso_issue_disabled",
      message: "Use /auth/oauth2/authorize with authorization_code + PKCE.",
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store",
        Deprecation: "true",
        Link: '</auth/oauth2/authorize>; rel="successor-version"',
      },
    }
  )
}

export const GET = legacyDisabledResponse
export const POST = legacyDisabledResponse
