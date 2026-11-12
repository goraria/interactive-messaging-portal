import { afterEach, beforeEach, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ preflight: vi.fn() }))
vi.mock("@/services/client/messenger", () => ({
  messengerRealtimeConnection: state.preflight,
}))
import { subscribeConversation } from "@/lib/realtime/client"

class Socket {
  static CLOSED = 3
  static instances: Socket[] = []
  readyState = 1
  onmessage?: (event: { data: unknown }) => void
  onerror?: () => void
  onclose?: (event: { code: number }) => void
  send = vi.fn()
  close = vi.fn(() => {
    this.readyState = 3
    this.onclose?.({ code: 1000 })
  })
  constructor(readonly url: URL) {
    Socket.instances.push(this)
  }
}
const listeners = new Map<string, () => void>()
beforeEach(() => {
  vi.useFakeTimers()
  Socket.instances = []
  listeners.clear()
  vi.stubGlobal("WebSocket", Socket)
  vi.stubGlobal("window", {
    location: { origin: "https://chat.example" },
    addEventListener: (event: string, listener: () => void) =>
      listeners.set(event, listener),
    removeEventListener: (event: string) => listeners.delete(event),
  })
  state.preflight
    .mockReset()
    .mockResolvedValue({
      url: "/chat/conversation/room/realtime/socket",
      transport: "websocket",
    })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function fixture() {
  const onSignal = vi.fn(),
    onReady = vi.fn(),
    onUnavailable = vi.fn(),
    onForbidden = vi.fn()
  const stop = subscribeConversation({
    conversationId: "room",
    onSignal,
    onReady,
    onUnavailable,
    onForbidden,
  })
  return { stop, onSignal, onReady, onUnavailable, onForbidden }
}
it("uses the same-origin socket and sends no credentials in its URL", async () => {
  const f = fixture()
  await vi.advanceTimersByTimeAsync(0)
  const socket = Socket.instances[0]!
  expect(socket.url.href).toBe(
    "wss://chat.example/chat/conversation/room/realtime/socket"
  )
  socket.onmessage!({
    data: '{"type":"chat.changed","conversationId":"room","sequence":"4"}',
  })
  expect(f.onReady).toHaveBeenCalledOnce()
  expect(f.onSignal).toHaveBeenCalledWith({
    type: "chat.changed",
    conversationId: "room",
    sequence: "4",
  })
  socket.onmessage!({ data: '{"type":"ping"}' })
  expect(socket.send).toHaveBeenCalledWith('{"type":"pong"}')
  f.stop()
  expect(listeners.size).toBe(0)
})
it("reconnects with another authenticated preflight and replays on the new signal", async () => {
  const f = fixture()
  await vi.advanceTimersByTimeAsync(0)
  Socket.instances[0]!.onclose!({ code: 1006 })
  await vi.advanceTimersByTimeAsync(800)
  expect(Socket.instances).toHaveLength(2)
  expect(state.preflight).toHaveBeenCalledTimes(2)
  Socket.instances[1]!.onmessage!({
    data: '{"type":"chat.changed","conversationId":"room","sequence":"99"}',
  })
  expect(f.onSignal).toHaveBeenCalledOnce()
  f.stop()
  await vi.advanceTimersByTimeAsync(60000)
  expect(Socket.instances).toHaveLength(2)
})
it.each([401, 403, 404])(
  "stops reconnecting when the HTTP gate returns %i",
  async (status) => {
    state.preflight.mockRejectedValue({ status })
    const f = fixture()
    await vi.advanceTimersByTimeAsync(60000)
    expect(f.onForbidden).toHaveBeenCalledOnce()
    expect(Socket.instances).toHaveLength(0)
    expect(state.preflight).toHaveBeenCalledOnce()
    f.stop()
  }
)
it("retries transient preflight failures, ignores foreign/malformed frames, and closes revoked sockets", async () => {
  state.preflight.mockRejectedValueOnce({ status: 503 })
  const f = fixture()
  await vi.advanceTimersByTimeAsync(800)
  const socket = Socket.instances[0]!
  for (const data of [
    "invalid",
    '{"type":"chat.changed","conversationId":"other","sequence":"1"}',
    new ArrayBuffer(2),
  ])
    socket.onmessage!({ data })
  expect(f.onSignal).not.toHaveBeenCalled()
  socket.onclose!({ code: 4403 })
  await vi.advanceTimersByTimeAsync(60000)
  expect(f.onForbidden).toHaveBeenCalledOnce()
  expect(Socket.instances).toHaveLength(1)
  f.stop()
})
it("cannot create a socket after unmount while preflight is pending", async () => {
  let resolve!: (value: unknown) => void
  state.preflight.mockReturnValue(
    new Promise((done) => {
      resolve = done
    })
  )
  const f = fixture()
  f.stop()
  resolve({
    url: "/chat/conversation/room/realtime/socket",
    transport: "websocket",
  })
  await vi.advanceTimersByTimeAsync(0)
  expect(Socket.instances).toHaveLength(0)
})

it("does not overlap connection attempts when online fires during preflight", async () => {
  let resolve!: (value: unknown) => void
  state.preflight.mockReturnValue(new Promise((done) => { resolve = done }))
  const f = fixture()
  listeners.get("online")!()
  listeners.get("online")!()
  expect(state.preflight).toHaveBeenCalledOnce()
  resolve({ url: "/chat/conversation/room/realtime/socket", transport: "websocket" })
  await vi.advanceTimersByTimeAsync(0)
  expect(Socket.instances).toHaveLength(1)
  f.stop()
})
