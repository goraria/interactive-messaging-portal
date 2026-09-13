import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession } from "@/lib/auth/dal"
import { accessTokenCookie } from "@/lib/utils/environment"
import { forwardRoomMessagesRoute } from "@/services/route"

interface RouteContext {
  params: Promise<{
    roomName: string
  }>
}

async function getAccessToken() {
  const cookieStore = await cookies()
  return cookieStore.get(accessTokenCookie)?.value ?? null
}

async function getTargetUrl(request: NextRequest, context: RouteContext) {
  const { roomName } = await context.params
  const target = new URL(
    `/chat/rooms/${encodeURIComponent(roomName)}/messages`,
    request.nextUrl.origin
  )

  target.search = request.nextUrl.search

  return target
}

export async function GET(request: NextRequest, context: RouteContext) {
  const accessToken = await getAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const response = await forwardRoomMessagesRoute({
    url: await getTargetUrl(request, context),
    method: "GET",
    accessToken,
  })
  response.headers.set("Cache-Control", "no-store")
  return response
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

  const response = await forwardRoomMessagesRoute({
    url: await getTargetUrl(request, context),
    method: "POST",
    body: await request.text(),
    accessToken,
  })
  response.headers.set("Cache-Control", "no-store")
  return response
}
