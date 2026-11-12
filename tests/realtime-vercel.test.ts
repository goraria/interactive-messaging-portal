import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { Hono } from "hono"
import { WebSocket } from "ws"
import type { WSEvents, WSContext } from "hono/ws"

const platform = vi.hoisted(() => ({ upgrade: vi.fn() }))
vi.mock("@vercel/functions", () => ({ upgradeWebSocket: platform.upgrade }))
import { upgradeVercelWebSocket } from "@/lib/realtime/vercel"

let socket: WebSocket
let events: WSEvents<WebSocket>
let connection: WSContext<WebSocket>
beforeEach(() => {
  vi.useFakeTimers()
  // Use ws's real EventTarget adapter; no network or Vercel credentials.
  // ws uses this server-side constructor internally; its public types omit options.
  socket = Reflect.construct(WebSocket, [null, undefined, { autoPong: true }])
  Object.defineProperty(socket, "readyState", { value: 1, writable: true })
  vi.spyOn(socket, "send").mockImplementation(() => {})
  vi.spyOn(socket, "close").mockImplementation(() => {})
  vi.spyOn(socket, "terminate").mockImplementation(() => {})
  events = {
    onOpen: vi.fn((_event, context) => { connection = context }),
    onMessage: vi.fn(), onClose: vi.fn(), onError: vi.fn(),
  }
  platform.upgrade.mockReset().mockImplementation(async (handler) => {
    handler(socket)
    return new Response(null, { status: 204 })
  })
})
afterEach(() => vi.useRealTimers())
const request = () => {
  const app = new Hono()
  app.get("/socket", upgradeVercelWebSocket(() => events))
  return app.request("https://chat.vercel.app/socket")
}

it("uses the platform upgrade with bounded payload and a live Hono context", async () => {
  expect((await request()).status).toBe(204)
  expect(platform.upgrade).toHaveBeenCalledWith(expect.any(Function), { maxPayload: 1024 })
  expect(events.onOpen).toHaveBeenCalledOnce()
  expect(connection.raw).toBe(socket)
  expect(connection.url?.href).toBe("https://chat.vercel.app/socket")
  connection.send("signal")
  expect(socket.send).toHaveBeenCalledWith("signal", { compress: false })
  Object.defineProperty(socket, "readyState", { value: 3 })
  expect(connection.readyState).toBe(3)
})

it("registers message/error/close handlers before onOpen and preserves frames", async () => {
  events.onOpen = vi.fn((_event, context) => {
    connection = context
    socket.emit("message", Buffer.from('{"type":"pong"}'), false)
  })
  await request()
  expect(events.onMessage).toHaveBeenCalledWith(
    expect.objectContaining({ data: '{"type":"pong"}' }), connection
  )
  socket.emit("error", new Error("fixture"))
  expect(events.onError).toHaveBeenCalledOnce()
  socket.emit("close", 1000, Buffer.from("finished"))
  expect(events.onClose).toHaveBeenCalledWith(
    expect.objectContaining({ code: 1000, reason: "finished" }), connection
  )
  await vi.advanceTimersByTimeAsync(300000)
  expect(socket.close).not.toHaveBeenCalled()
})

it("rotates long-lived connections and terminates peers that ignore close", async () => {
  await request()
  await vi.advanceTimersByTimeAsync(270000)
  expect(socket.close).toHaveBeenCalledWith(1012, "reconnect")
  await vi.advanceTimersByTimeAsync(1000)
  expect(socket.terminate).toHaveBeenCalledOnce()
})

it("cancels the forced terminate after a successful rotation close", async () => {
  await request()
  await vi.advanceTimersByTimeAsync(270000)
  socket.emit("close", 1012, Buffer.from("reconnect"))
  await vi.advanceTimersByTimeAsync(1000)
  expect(socket.terminate).not.toHaveBeenCalled()
})
