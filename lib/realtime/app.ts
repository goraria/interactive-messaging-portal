import "server-only"
import { Hono } from "hono"
import type { UpgradeWebSocket } from "hono/ws"
import { HTTPException } from "hono/http-exception"
import { configureHono } from "@gorth-io/principle/configs/hono"
import type { ApiEnv } from "@/utils/interface"
import { appUrl } from "@/utils/environment"
import { requireAuth } from "@/middlewares/auth"
import { getVerifiedUser } from "@/utils/controller"
import { chatId } from "@/schemas/chat-domain"
import { getCurrentUserRow } from "@/services/users"
import { readAppIdentity } from "@/services/session"
import { readConversationSignal } from "@/services/realtime"
import { incomingChatCalls } from "@/services/chat-calls"
import { createRealtimeConnection } from "@/lib/realtime/connection"
import { subscribeRealtimeInvalidation } from "@/lib/realtime/invalidation"

export function createRealtimeApp<Socket>(
  upgradeWebSocket: UpgradeWebSocket<Socket>
) {
  const app = new Hono<ApiEnv>()
  configureHono(app, {
    logger: false,
    cors: false,
    csrf: false,
    rateLimit: false,
    compress: false,
    etag: false,
    bodyLimit: { maxSize: 1024 },
  })
  let connections = 0
  const users = new Map<string, number>()
  const registerSocket = (path: string, incoming = false) => {
    app.get(
      path,
      async (context, next) => {
        // A WebSocket upgrade is GET but is not a harmless cross-origin read.
        if (!appUrl || context.req.header("origin") !== new URL(appUrl).origin)
          return context.json({ error: "invalid_origin" }, 403)
        if (context.req.header("upgrade")?.toLowerCase() !== "websocket")
          return context.json({ error: "websocket_upgrade_required" }, 426)
        // Browser sockets use the existing session, never bearer tokens in a URL.
        if (context.req.header("authorization"))
          return context.json({ error: "session_required" }, 401)
        return next()
      },
      requireAuth(),
      async (context, next) => {
        const authUser = getVerifiedUser(context)
        if (!authUser) return context.json({ error: "unauthorized" }, 401)
        const parsed = incoming
          ? null
          : chatId.safeParse(context.req.param("conversationId"))
        if (parsed && !parsed.success)
          return context.json({ error: "invalid_conversation" }, 400)
        const user = await getCurrentUserRow(authUser)
        const conversationId = parsed?.success ? parsed.data : null
        if (conversationId)
          await readConversationSignal(conversationId, user.id)
        if (connections >= 500 || (users.get(user.id) ?? 0) >= 5)
          return context.json({ error: "connection_limit" }, 429)
        connections++
        users.set(user.id, (users.get(user.id) ?? 0) + 1)
        let released = false
        const release = () => {
          if (released) return
          released = true
          connections--
          const count = (users.get(user.id) ?? 1) - 1
          if (count) users.set(user.id, count)
          else users.delete(user.id)
        }
        const headers = new Headers(context.req.raw.headers)
        const events = createRealtimeConnection({
          conversationId: conversationId ?? "incoming-call",
          subscribe: conversationId
            ? (wake) => subscribeRealtimeInvalidation(conversationId, wake)
            : undefined,
          readSignal: conversationId
            ? () => readConversationSignal(conversationId, user.id)
            : async () =>
                JSON.stringify({
                  type: "chat.call",
                  calls: await incomingChatCalls(user.id),
                }),
          serializeSignal: incoming ? (snapshot) => snapshot : undefined,
          reauthorize: async () =>
            (await readAppIdentity(headers))?.user.id === user.id,
          onClose: release,
        })
        try {
          const response = await upgradeWebSocket(() => events)(context, next)
          if (!response || response.status >= 400) release()
          return response
        } catch (error) {
          release()
          throw error
        }
      }
    )
  }
  registerSocket("/chat/conversation/:conversationId/realtime/socket")
  registerSocket("/chat/realtime/call/socket", true)
  app.onError((error, context) => {
    if (error instanceof HTTPException) return error.getResponse()
    const status = (error as { statusCode?: number }).statusCode
    return context.json(
      { error: "realtime_unavailable" },
      status === 403 || status === 404 ? status : 503
    )
  })
  return app
}
