import { timingSafeEqual } from "node:crypto"
import { cronSecret } from "@/utils/environment"
import { enqueueBackgroundJob } from "@/services/background"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function GET(request: Request) {
  if (!cronSecret) return new Response(null, { status: 503 })
  const supplied = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from("Bearer " + cronSecret)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    return new Response(null, { status: 401 })
  await enqueueBackgroundJob()
  return Response.json({ queued: true })
}
