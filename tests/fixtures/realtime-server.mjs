// Real Hono + ws Node transport fixture: no env, database or SSO connection.
import { Hono } from "hono"
import { createAdaptorServer, upgradeWebSocket } from "@hono/node-server"
import { WebSocketServer } from "ws"
import { createRealtimeConnection } from "../../lib/realtime/connection.ts"
import { subscribeRealtimeInvalidation, invalidateRealtimeConversation } from "../../lib/realtime/invalidation.ts"
let sequence = "1",
  allowed = true
const app = new Hono()
app.get(
  "/socket",
  (c, next) => {
    // Node's standard WebSocket client cannot supply Origin; production origin
    // enforcement is covered separately against createRealtimeApp.
    if (
      c.req.header("origin") &&
      c.req.header("origin") !== "https://chat.fixture"
    )
      return c.text("forbidden", 403)
    return next()
  },
  upgradeWebSocket(() =>
    createRealtimeConnection({
      conversationId: "room",
      intervalMs: 60000,
      subscribe: (wake) => subscribeRealtimeInvalidation("room", wake),
      readSignal: async () => {
        if (!allowed)
          throw Object.assign(new Error("removed"), { statusCode: 403 })
        return sequence
      },
      reauthorize: async () => true,
      onClose: () => {},
    })
  )
)
app.post("/advance", (c) => {
  sequence = "2"
  invalidateRealtimeConversation("room")
  return c.text("ok")
})
app.post("/revoke", (c) => {
  allowed = false
  invalidateRealtimeConversation("room")
  return c.text("ok")
})
const sockets = new WebSocketServer({
  noServer: true,
  maxPayload: 1024,
  perMessageDeflate: false,
})
const server = createAdaptorServer({
  fetch: app.fetch,
  overrideGlobalObjects: false,
  websocket: { server: sockets },
})
server.listen(0, "127.0.0.1", () => console.log(server.address().port))
process.on("SIGTERM", () => {
  for (const socket of sockets.clients) socket.terminate()
  sockets.close()
  server.close(() => process.exit(0))
})
