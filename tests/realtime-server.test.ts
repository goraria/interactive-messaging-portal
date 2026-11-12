import { EventEmitter } from "node:events"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({
  config: { websocketPort: 3030, appUrl: "http://localhost:3030" },
  app: vi.fn(),
  create: vi.fn(),
  sockets: vi.fn(),
}))
vi.mock("@/utils/environment", () => state.config)
vi.mock("@/lib/realtime/app", () => ({ createRealtimeApp: state.app }))
vi.mock("@hono/node-server", () => ({
  createAdaptorServer: state.create,
  upgradeWebSocket: vi.fn(),
}))
vi.mock("ws", () => ({
  WebSocketServer: class {
    constructor(options: unknown) {
      return state.sockets(options)
    }
  },
}))
import { startRealtimeServer, stopRealtimeServer } from "@/lib/realtime/server"
let server: EventEmitter & {
  listen: ReturnType<typeof vi.fn>
  unref: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}
let sockets: {
  close: ReturnType<typeof vi.fn>
  clients: Set<{ terminate: ReturnType<typeof vi.fn> }>
}
beforeEach(() => {
  state.config.websocketPort = 3030
  state.app.mockReset().mockReturnValue({ fetch: vi.fn() })
  server = Object.assign(new EventEmitter(), {
    listen: vi.fn((_port, _host, done) => {
      queueMicrotask(done)
      return server
    }),
    unref: vi.fn(),
    close: vi.fn(() => {
      server.emit("close")
    }),
  })
  sockets = { close: vi.fn(), clients: new Set([{ terminate: vi.fn() }]) }
  state.create.mockReset().mockReturnValue(server)
  state.sockets.mockReset().mockReturnValue(sockets)
  vi.spyOn(console, "info").mockImplementation(() => {})
})
afterEach(() => {
  stopRealtimeServer()
  vi.restoreAllMocks()
})
it("uses Hono's native Node adapter with a bounded noServer ws server", async () => {
  await startRealtimeServer()
  expect(state.sockets).toHaveBeenCalledWith({
    noServer: true,
    maxPayload: 1024,
    perMessageDeflate: false,
  })
  expect(state.create).toHaveBeenCalledWith({
    fetch: expect.any(Function),
    overrideGlobalObjects: false,
    websocket: { server: sockets },
  })
  expect(server.listen).toHaveBeenCalledWith(
    3037,
    "127.0.0.1",
    expect.any(Function)
  )
  expect(server.unref).toHaveBeenCalledOnce()
})
it("shares startup and the listener across concurrent registrations", async () => {
  const a = startRealtimeServer(),
    b = startRealtimeServer()
  expect(a).toBe(b)
  await Promise.all([a, b])
  await startRealtimeServer()
  expect(state.create).toHaveBeenCalledOnce()
})
it("closes active clients and releases resources without accumulating handlers", async () => {
  const count = process.listenerCount("SIGTERM")
  await startRealtimeServer()
  expect(process.listenerCount("SIGTERM")).toBe(count + 1)
  stopRealtimeServer()
  stopRealtimeServer()
  expect(
    sockets.clients.values().next().value!.terminate
  ).toHaveBeenCalledOnce()
  expect(sockets.close).toHaveBeenCalledOnce()
  expect(server.close).toHaveBeenCalledOnce()
  expect(process.listenerCount("SIGTERM")).toBe(count)
})
it.each([0, 65536, NaN])("refuses invalid port %s", async (port) => {
  state.config.websocketPort = port
  await expect(startRealtimeServer()).rejects.toThrow(
    "Invalid NEXT_WEBSOCKET_PORT"
  )
  expect(state.create).not.toHaveBeenCalled()
})
it("rejects bind failures, cleans up, and allows a later retry", async () => {
  server.listen.mockImplementationOnce(() => {
    queueMicrotask(() => server.emit("error", new Error("port in use")))
    return server
  })
  await expect(startRealtimeServer()).rejects.toThrow("port in use")
  expect(sockets.close).toHaveBeenCalledOnce()
  await startRealtimeServer()
  expect(state.create).toHaveBeenCalledTimes(2)
})
it("closes ws if Hono adapter construction fails", async () => {
  state.create.mockImplementationOnce(() => {
    throw new Error("adapter error")
  })
  await expect(startRealtimeServer()).rejects.toThrow("adapter error")
  expect(sockets.close).toHaveBeenCalledOnce()
})
