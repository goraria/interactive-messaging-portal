import { createServer } from "node:http"
import { AsyncLocalStorage } from "node:async_hooks"
import { once } from "node:events"
import { Hono } from "hono"
import { WebSocket } from "ws"
import { expect, it } from "vitest"
import { upgradeVercelWebSocket } from "@/lib/realtime/vercel"

it("runs real ws upgrades through the installed Vercel SDK and Hono bridge", async () => {
  // Only the platform's raw upgrade context is simulated. SDK, Hono and ws are real.
  const key = Symbol.for("@vercel/request-context")
  const globals = globalThis as typeof globalThis & { [key: symbol]: unknown }
  const previous = globals[key]
  const context = new AsyncLocalStorage<unknown>()
  globals[key] = { get: () => context.getStore() }
  const app = new Hono()
  const clients: WebSocket[] = []
  const sockets: WebSocket[] = []
  app.get("/socket", upgradeVercelWebSocket(() => ({
    onOpen(_event, ws) { sockets.push(ws.raw!); ws.send("ready") },
    onMessage(event, ws) {
      if (typeof event.data === "string") ws.send("received:" + event.data)
      else ws.close(1008, "subscribe_only")
    },
    onError() {},
  })))
  const server = createServer()
  server.on("upgrade", (req, socket, head) => {
    void context.run({ upgradeWebSocket: () => ({ req, socket, head }) }, async () => {
      const headers = new Headers()
      for (const [name, value] of Object.entries(req.headers))
        if (value) headers.set(name, Array.isArray(value) ? value.join(", ") : value)
      await app.fetch(new Request("http://localhost/socket", { headers }))
    })
  })
  try {
    server.listen(0, "127.0.0.1")
    await once(server, "listening")
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Missing fixture port")
    const connect = async () => {
      const socket = new WebSocket(`ws://127.0.0.1:${address.port}/socket`)
      clients.push(socket)
      const ready = once(socket, "message")
      await once(socket, "open")
      expect(String((await ready)[0])).toBe("ready")
      return socket
    }
    const first = await connect()
    const message = once(first, "message")
    first.send('{"type":"pong"}')
    expect(String((await message)[0])).toBe('received:{"type":"pong"}')
    const closed = once(first, "close")
    first.send(Buffer.from("binary"))
    expect((await closed)[0]).toBe(1008)
    const oversized = await connect()
    const rejected = once(oversized, "close")
    oversized.send("x".repeat(1025))
    expect((await rejected)[0]).toBe(1009)
  } finally {
    for (const socket of [...clients, ...sockets]) socket.terminate()
    server.close()
    if (previous === undefined) delete globals[key]
    else globals[key] = previous
  }
})
