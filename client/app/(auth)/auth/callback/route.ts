import { NextResponse } from "next/server"

export function GET(request: Request) {
  const url = new URL(request.url)
  const oauthUrl = new URL("/auth/oauth", url.origin)
  oauthUrl.search = url.search

  return NextResponse.redirect(oauthUrl)
}
