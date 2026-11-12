import { NextResponse, type NextRequest } from "next/server"
import { verifySession } from "@/lib/auth/dal"
import { getSafeHeaders } from "@/utils/formatter"
import type {
  DemoApiData,
  EndpointApiResponseEnvelope,
} from "@/utils/interface"

async function getRequestBody(request: NextRequest) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const session = await verifySession()
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const data: DemoApiData = {
    id: "next-router-demo",
    source: "Next.js route handler",
    route: request.nextUrl.pathname,
    url: request.nextUrl.toString(),
    method: request.method,
    status: "ok",
    generatedAt: new Date().toISOString(),
    params: Object.fromEntries(request.nextUrl.searchParams.entries()),
    body: await getRequestBody(request),
    headers: getSafeHeaders(request.headers),
    cookieNames: request.cookies.getAll().map((cookie) => cookie.name),
    hasAuthorization: request.headers.has("authorization"),
  }
  const response: EndpointApiResponseEnvelope<DemoApiData> = {
    data,
    message: "Demo API loaded",
  }
  return NextResponse.json(response)
}
