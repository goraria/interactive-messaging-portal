import "server-only"
import { upgradeWebSocket } from "@vercel/functions"
import { defineWebSocketHelper, WSContext } from "hono/ws"
import type { WebSocket } from "ws"

// Reuse Hono's session/origin/member guards and connection lifecycle on Vercel.
// The platform helper supplies an already-open ws connection, not a new server.
export const upgradeVercelWebSocket = defineWebSocketHelper<WebSocket>(
  (context, events) => upgradeWebSocket((socket) => {
    socket.binaryType = "arraybuffer"
    const ws = new WSContext({
      raw: socket,
      url: context.req.url,
      protocol: socket.protocol,
      get readyState() { return socket.readyState },
      send: (data) => socket.send(data, { compress: false }),
      close: (code, reason) => socket.close(code, reason),
    })
    // Reconnect/replay before the Route Handler's 300-second duration expires.
    const rotation = setTimeout(() => {
      socket.close(1012, "reconnect")
      const timeout = setTimeout(() => socket.terminate(), 1000)
      timeout.unref?.()
      socket.once("close", () => clearTimeout(timeout))
    }, 270000)
    rotation.unref?.()
    // Install all handlers synchronously before invoking onOpen.
    socket.addEventListener("message", (event) => {
      const data = event.data
      if (typeof data !== "string" && !(data instanceof ArrayBuffer)) {
        socket.close(1008, "subscribe_only")
        return
      }
      events.onMessage?.(new MessageEvent("message", { data }), ws)
    })
    socket.addEventListener("close", (event) => {
      clearTimeout(rotation)
      events.onClose?.(new CloseEvent("close", {
        code: event.code, reason: event.reason, wasClean: event.wasClean,
      }), ws)
    })
    socket.addEventListener("error", () => {
      events.onError?.(new Event("error"), ws)
    })
    events.onOpen?.(new Event("open"), ws)
  }, { maxPayload: 1024 })
)
