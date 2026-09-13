import { NextResponse, type NextRequest } from "next/server"
import { verifySession } from "@/lib/auth/dal"
import type {
  DemoApiData,
  EndpointApiResponseEnvelope,
} from "@/lib/utils/interface"

async function getRequestBody(request: NextRequest) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function getSafeHeaders(request: NextRequest) {
  const hiddenHeaders = new Set(["authorization", "cookie"])
  return Object.fromEntries(
    Array.from(request.headers.entries()).filter(
      ([key]) => !hiddenHeaders.has(key.toLowerCase())
    )
  )
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
    headers: getSafeHeaders(request),
    cookieNames: request.cookies.getAll().map((cookie) => cookie.name),
    hasAuthorization: request.headers.has("authorization"),
  }
  const response: EndpointApiResponseEnvelope<DemoApiData> = {
    data,
    message: "Demo API loaded",
  }
  return NextResponse.json(response)
}
