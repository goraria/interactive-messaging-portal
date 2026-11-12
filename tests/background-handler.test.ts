import { beforeEach, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({
  handle: vi.fn(), after: vi.fn(), enqueue: vi.fn(), realtime: vi.fn(),
}))
vi.mock("@hono/vercel", () => ({ handle: () => state.handle }))
vi.mock("next/server", () => ({ after: state.after }))
vi.mock("@/app/api", () => ({ api: {} }))
vi.mock("@/services/background", () => ({ enqueueBackgroundJob: state.enqueue }))
vi.mock("@/services/chat-delivery", () => ({ dispatchChatEvents: state.realtime }))

import { POST } from "@/app/(api)/chat/message/[[...path]]/route"
import { handleBackgroundApi } from "@/lib/background-handler"

beforeEach(() => {
  state.handle.mockReset().mockResolvedValue(new Response(null, { status: 201 }))
  state.after.mockReset()
  state.enqueue.mockReset().mockResolvedValue(undefined)
  state.realtime.mockReset().mockResolvedValue({ claimed: 0, failed: 0 })
})

it("enqueues after the concrete message route commits its successful response", async () => {
  const response = await POST(new Request("https://chat.example/chat/message", { method: "POST" }))
  expect(response.status).toBe(201)
  expect(state.enqueue).not.toHaveBeenCalled()
  expect(state.after).toHaveBeenCalledOnce()
  await state.after.mock.calls[0]![0]()
  expect(state.enqueue).toHaveBeenCalledOnce()
  expect(state.realtime).toHaveBeenCalledWith(undefined, "realtime")
})

it("starts realtime delivery even while Queue enqueue is stalled", async () => {
  let release!: () => void
  state.enqueue.mockReturnValueOnce(new Promise<void>((resolve) => { release = resolve }))
  await POST(new Request("https://chat.example/chat/message", { method: "POST" }))
  const background = state.after.mock.calls[0]![0]()
  expect(state.realtime).toHaveBeenCalledOnce()
  release()
  await background
})

it("keeps Queue recovery when immediate realtime delivery fails", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {})
  state.realtime.mockResolvedValueOnce({ claimed: 1, failed: 1 })
  await POST(new Request("https://chat.example/chat/message", { method: "POST" }))
  await state.after.mock.calls[0]![0]()
  expect(state.enqueue).toHaveBeenCalledOnce()
  expect(log).toHaveBeenCalledWith("[background] realtime_deferred; outbox retained for recovery")
})

it.each([
  ["GET", "/chat/message", 200],
  ["POST", "/chat/message", 403],
  ["POST", "/auth/sign-in/social", 200],
  ["POST", "/auth", 200],
])("does not enqueue %s %s with status %i", async (method, path, status) => {
  state.handle.mockResolvedValueOnce(new Response(null, { status }))
  await handleBackgroundApi(new Request("https://chat.example" + path, { method }))
  expect(state.after).not.toHaveBeenCalled()
})

it("preserves the committed response if Queue is unavailable; Cron can recover the outbox", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {})
  state.enqueue.mockRejectedValueOnce(new Error("queue offline"))
  const response = await POST(new Request("https://chat.example/chat/message", { method: "POST" }))
  await expect(state.after.mock.calls[0]![0]()).resolves.toBeUndefined()
  expect(response.status).toBe(201)
  expect(log).toHaveBeenCalledWith("[background] enqueue_failed; outbox retained for recovery")
})
