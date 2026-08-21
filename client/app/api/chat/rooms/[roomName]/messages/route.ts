import { NextRequest, NextResponse } from "next/server"
import { apiBaseUrl } from "@/lib/environment"
import { verifySession } from "@/lib/dal"
import { getAccountDisplayName } from "@/lib/utils/formatter"

interface RouteContext {
  params: Promise<{
    roomName: string
  }>
}

function getServerBaseUrl() {
  return apiBaseUrl ?? "http://localhost:8080"
}

function encodeUserHeader(value: string | undefined | null) {
  return encodeURIComponent(value ?? "")
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
  const response = await fetch(await getTargetUrl(request, context), {
    method: "GET",
    headers: {
      Accept: "application/json",
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

  if (!session) {
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
      "x-gorth-user-id": encodeUserHeader(session.user.id),
      "x-gorth-user-name": encodeUserHeader(
        getAccountDisplayName(
          undefined,
          session.user.email,
          session.user.user_metadata
        )
      ),
      "x-gorth-user-email": encodeUserHeader(session.user.email),
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
