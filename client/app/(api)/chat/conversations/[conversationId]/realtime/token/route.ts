import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { accessTokenCookie } from "@/lib/utils/environment"
import { forwardAuthenticatedRoute } from "@/services/route"

interface RouteContext {
  params: Promise<{ conversationId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(accessTokenCookie)?.value

  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { conversationId } = await context.params
  const response = await forwardAuthenticatedRoute({
    path: `/chat/conversations/${encodeURIComponent(conversationId)}/realtime/token`,
    accessToken,
  })

  return NextResponse.json(response.data.data ?? response.data, {
    status: response.status,
    headers: { "Cache-Control": "no-store" },
  })
}
