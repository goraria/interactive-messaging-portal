import { NextRequest, NextResponse } from "next/server"
import { isAbsoluteHttpUrl, resolveRedirect } from "@/lib/formatter"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const isOAuthProviderFlow = Boolean(
    searchParams.get("client_id") &&
    searchParams.get("redirect_uri") &&
    searchParams.get("response_type")
  )

  if (isOAuthProviderFlow) {
    return NextResponse.redirect(
      `${origin}/auth/oauth2/authorize?${searchParams.toString()}`
    )
  }

  const next = searchParams.get("next")
  const externalTarget = resolveRedirect(next)

  if (externalTarget) {
    return NextResponse.redirect(
      `${origin}/auth/error?error=legacy_sso_issue_disabled`
    )
  }

  if (isAbsoluteHttpUrl(next)) {
    return NextResponse.redirect(`${origin}/auth/error?error=invalid_redirect`)
  }

  const relativeNext =
    next?.startsWith("/") && !next.startsWith("//") ? next : "/"
  const forwardedHost = request.headers.get("x-forwarded-host")
  const isLocalEnv = process.env.NODE_ENV === "development"
  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${relativeNext}`)
  } else if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${relativeNext}`)
  } else {
    return NextResponse.redirect(`${origin}${relativeNext}`)
  }
}
