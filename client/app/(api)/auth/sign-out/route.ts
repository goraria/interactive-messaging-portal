import { NextRequest, NextResponse } from "next/server"
import { getCorsHeaders, resolveRedirect } from "@/lib/utils/formatter"

const ssoServerUrl =
  process.env.SSO_SERVER_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8080"

const ssoPublicUrl = process.env.NEXT_PUBLIC_AUTH_URL

function getServerBaseUrl() {
  if (!ssoServerUrl) {
    throw new Error("Missing SSO_SERVER_INTERNAL_URL")
  }

  return ssoServerUrl
}

function getPublicOrigin(request: NextRequest) {
  try {
    return new URL(ssoPublicUrl ?? request.nextUrl.origin).origin
  } catch {
    return request.nextUrl.origin
  }
}

function copySetCookie(target: NextResponse, source: Response) {
  const headers = source.headers as Headers & { getSetCookie?: () => string[] }
  const setCookies = headers.getSetCookie?.() ?? []
  const fallbackSetCookie = source.headers.get("set-cookie")
  const cookies =
    setCookies.length > 0
      ? setCookies
      : fallbackSetCookie
        ? [fallbackSetCookie]
        : []

  for (const cookie of cookies) {
    target.headers.append("set-cookie", cookie)
  }

  return target
}

async function signOut(request: NextRequest) {
  const origin = getPublicOrigin(request)

  return fetch(new URL("/auth/sign-out", getServerBaseUrl()), {
    method: "POST",
    headers: {
      ...(request.headers.get("cookie")
        ? { Cookie: request.headers.get("cookie")! }
        : {}),
      ...(process.env.SSO_CLIENT_INTERNAL_SECRET
        ? { "x-sso-client-secret": process.env.SSO_CLIENT_INTERNAL_SECRET }
        : {}),
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: origin,
      Referer: `${origin}/auth/sign-out`,
    },
    body: "{}",
    cache: "no-store",
  })
}

async function getErrorDetail(response: Response) {
  const contentType = response.headers.get("content-type") ?? ""

  try {
    if (contentType.includes("application/json")) {
      return await response.json()
    }

    const text = await response.text()
    return text ? { message: text } : undefined
  } catch {
    return undefined
  }
}

export async function GET(request: NextRequest) {
  const signOutResponse = await signOut(request)
  const returnTo = resolveRedirect(
    new URL(request.url).searchParams.get("returnTo")
  )

  return copySetCookie(
    NextResponse.redirect(
      returnTo ?? new URL("/auth/sign-in", request.url).toString()
    ),
    signOutResponse
  )
}

export async function POST(request: NextRequest) {
  const signOutResponse = await signOut(request)
  const headers = getCorsHeaders(request)

  if (!signOutResponse.ok) {
    return copySetCookie(
      NextResponse.json(
        {
          ok: false,
          error: "sso_sign_out_failed",
          status: signOutResponse.status,
          detail: await getErrorDetail(signOutResponse),
        },
        { status: signOutResponse.status, headers }
      ),
      signOutResponse
    )
  }

  return copySetCookie(
    NextResponse.json({ ok: true }, { headers }),
    signOutResponse
  )
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  })
}
