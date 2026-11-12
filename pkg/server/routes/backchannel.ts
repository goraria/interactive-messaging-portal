import { Hono } from "hono"
import { AuthError } from "@gorth/structure/modules/auth/server"
import { getAuthRuntime } from "@/lib/auth/runtime"
const router = new Hono()
router.post("/backchannel-logout", async (context) => {
  context.header("Cache-Control", "no-store")
  try {
    if (
      !context.req
        .header("content-type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      return context.json({ error: "invalid_request" }, 415)
    const reader = context.req.raw.body?.getReader()
    if (!reader) return context.json({ error: "invalid_request" }, 400)
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const part = await reader.read()
        if (part.done) break
        size += part.value.byteLength
        if (size > 32768) {
          await reader.cancel()
          return context.json({ error: "payload_too_large" }, 413)
        }
        chunks.push(part.value)
      }
    } finally {
      reader.releaseLock()
    }
    const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"))
    const token = form.get("logout_token")
    if (!token || form.getAll("logout_token").length !== 1)
      return context.json({ error: "invalid_request" }, 400)
    await getAuthRuntime().logout.handle(token)
    return context.body(null, 200)
  } catch (error) {
    const unavailable =
      !(error instanceof AuthError) ||
      error.code === "unavailable" ||
      error.code === "invalid_configuration"
    return context.json(
      { error: unavailable ? "auth_unavailable" : "invalid_logout_token" },
      unavailable ? 503 : 400
    )
  }
})
export default router
