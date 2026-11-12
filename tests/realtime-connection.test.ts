import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { WSContext } from "hono/ws"
import { createRealtimeConnection } from "@/lib/realtime/connection"
import { parseRealtimeSignal } from "@/utils/realtime"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
function fixture(subscribe?: (wake: () => void) => () => void) {
  const readSignal = vi.fn().mockResolvedValue("10")
  const reauthorize = vi.fn().mockResolvedValue(true)
  const send = vi.fn(),
    close = vi.fn(),
    cleanup = vi.fn()
  const raw = { bufferedAmount: 0 }
  const ws = new WSContext({ send, close, raw, readyState: 1 })
  const events = createRealtimeConnection({
    conversationId: "room",
    readSignal,
    reauthorize,
    onClose: cleanup,
    subscribe,
  })
  events.onOpen!(new Event("open"), ws)
  return { readSignal, reauthorize, send, close, cleanup, raw, ws, events }
}
it("wakes immediately and rechecks a mutation arriving during an in-flight read", async () => {
  let wake!: () => void
  const unsubscribe = vi.fn()
  const f = fixture((listener) => { wake = listener; return unsubscribe })
  await vi.advanceTimersByTimeAsync(0)
  let finish!: (value: string) => void
  f.readSignal.mockImplementationOnce(() => new Promise<string>((resolve) => { finish = resolve }))
  wake()
  wake()
  f.readSignal.mockResolvedValue("12")
  finish("11")
  await vi.advanceTimersByTimeAsync(0)
  expect(f.readSignal).toHaveBeenCalledTimes(3)
  expect(JSON.parse(f.send.mock.calls.at(-1)![0]).sequence).toBe("12")
  f.events.onClose!(new CloseEvent("close"), f.ws)
  expect(unsubscribe).toHaveBeenCalledOnce()
  wake()
  expect(f.readSignal).toHaveBeenCalledTimes(3)
})
it("emits only a scoped high-water mark; unchanged signals are deduplicated", async () => {
  const f = fixture()
  await vi.advanceTimersByTimeAsync(3000)
  expect(f.send).toHaveBeenCalledOnce()
  expect(JSON.parse(f.send.mock.calls[0]![0])).toEqual({
    type: "chat.changed",
    conversationId: "room",
    sequence: "10",
  })
  f.readSignal.mockResolvedValue("12")
  await vi.advanceTimersByTimeAsync(1000)
  expect(f.send).toHaveBeenCalledTimes(2)
  f.events.onClose!(new CloseEvent("close"), f.ws)
})
it("closes a removed member without delivering another signal", async () => {
  const f = fixture()
  await vi.advanceTimersByTimeAsync(0)
  f.readSignal.mockRejectedValue({ statusCode: 403 })
  await vi.advanceTimersByTimeAsync(1000)
  expect(f.close).toHaveBeenCalledWith(4403, "realtime_unavailable")
  expect(f.send).toHaveBeenCalledOnce()
  expect(f.cleanup).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(5000)
  expect(f.readSignal).toHaveBeenCalledTimes(2)
})
it("revalidates the existing session and closes on logout/revocation", async () => {
  const f = fixture()
  await vi.advanceTimersByTimeAsync(0)
  f.reauthorize.mockResolvedValue(false)
  await vi.advanceTimersByTimeAsync(15000)
  expect(f.close).toHaveBeenCalledWith(4401, "session_expired")
  expect(f.reauthorize).toHaveBeenCalledTimes(2)
})
it("fails closed on database/auth outages", async () => {
  const f = fixture()
  f.reauthorize.mockRejectedValue(new Error("database offline"))
  await vi.advanceTimersByTimeAsync(15000)
  expect(f.close).toHaveBeenCalledWith(1013, "realtime_unavailable")
})
it("accepts heartbeat pong but rejects client publish frames", async () => {
  const f = fixture()
  await vi.advanceTimersByTimeAsync(15000)
  expect(f.send).toHaveBeenCalledWith('{"type":"ping"}', {})
  f.events.onMessage!(
    new MessageEvent("message", { data: '{"type":"pong"}' }),
    f.ws
  )
  await vi.advanceTimersByTimeAsync(15000)
  expect(f.close).not.toHaveBeenCalled()
  f.events.onMessage!(
    new MessageEvent("message", {
      data: '{"type":"message","content":"forged"}',
    }),
    f.ws
  )
  expect(f.close).toHaveBeenCalledWith(1008, "subscribe_only")
})
it("disconnects a dead or slow client and cleans up once", async () => {
  const f = fixture()
  await vi.advanceTimersByTimeAsync(30000)
  expect(f.close).toHaveBeenCalledWith(1001, "heartbeat_timeout")
  f.events.onClose!(new CloseEvent("close"), f.ws)
  expect(f.cleanup).toHaveBeenCalledOnce()
  const slow = fixture()
  slow.raw.bufferedAmount = 65537
  await vi.advanceTimersByTimeAsync(0)
  expect(slow.close).toHaveBeenCalledWith(1013, "slow_reader")
})
it("does not overlap polling queries or send after disposal", async () => {
  const f = fixture()
  await vi.advanceTimersByTimeAsync(0)
  let resolve!: (value: string) => void
  f.readSignal.mockReturnValue(
    new Promise<string>((done) => {
      resolve = done
    })
  )
  await vi.advanceTimersByTimeAsync(5000)
  expect(f.readSignal).toHaveBeenCalledTimes(2)
  f.events.onClose!(new CloseEvent("close"), f.ws)
  resolve("99")
  await vi.advanceTimersByTimeAsync(0)
  expect(f.send).toHaveBeenCalledOnce()
})
it("closes a hung query without leaking later frames", async () => {
  const f = fixture()
  await vi.advanceTimersByTimeAsync(0)
  let resolve!: (value: string) => void
  f.readSignal.mockReturnValue(new Promise<string>((done) => { resolve = done }))
  await vi.advanceTimersByTimeAsync(11000)
  expect(f.close).toHaveBeenCalledWith(1013, "realtime_timeout")
  resolve("99")
  await vi.advanceTimersByTimeAsync(0)
  expect(f.send).toHaveBeenCalledOnce()
})

it("validates only expected conversation signals and strips arbitrary payload", () => {
  expect(
    parseRealtimeSignal(
      {
        type: "chat.changed",
        conversationId: "room",
        sequence: "4",
        content: "secret",
      },
      "room"
    )
  ).toEqual({ type: "chat.changed", conversationId: "room", sequence: "4" })
  for (const input of [
    null,
    { type: "chat.changed", conversationId: "other", sequence: "1" },
    { type: "chat.changed", conversationId: "room", sequence: -1 },
    { type: "chat.changed", conversationId: "room", sequence: "1e10" },
  ])
    expect(parseRealtimeSignal(input, "room")).toBeNull()
})
