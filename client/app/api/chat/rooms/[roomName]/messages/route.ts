import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { gorthAccessTokenCookie, verifySession } from "@/lib/auth/dal"
import { apiBaseUrl } from "@/lib/utils/environment"

interface RouteContext {
  params: Promise<{
    roomName: string
  }>
}

function getServerBaseUrl() {
  return apiBaseUrl ?? "http://localhost:8080"
}

async function getAccessToken() {
  const cookieStore = await cookies()
  return cookieStore.get(gorthAccessTokenCookie)?.value ?? null
}

async function getTargetUrl(request: NextRequest, context: RouteContext) {
  const { roomName } = await context.params
  const target = new URL(
    `/chat/rooms/${encodeURIComponent(roomName)}/messages`,
    getServerBaseUrl()
  )

  target.search = request.nextUrl.search

  return target
}

export async function GET(request: NextRequest, context: RouteContext) {
  const accessToken = await getAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const response = await fetch(await getTargetUrl(request, context), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  })

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      "Content-Type":
        response.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  })
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await verifySession()
  const accessToken = await getAccessToken()

  if (!session || !accessToken) {
    return NextResponse.json(
      { error: "unauthorized" },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  }

  const response = await fetch(await getTargetUrl(request, context), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: await request.text(),
    cache: "no-store",
  })

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      "Content-Type":
        response.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  })
}
