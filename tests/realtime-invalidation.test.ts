import { expect, it, vi } from "vitest"
import { invalidateRealtimeConversation, subscribeRealtimeInvalidation } from "@/lib/realtime/invalidation"
import { recordRealtimeMutation, withRealtimeMutations } from "@/lib/realtime/mutation"

it("wakes only the affected conversation after a successful committed request", async () => {
  const wake = vi.fn(), unrelated = vi.fn()
  const stop = subscribeRealtimeInvalidation("room", wake)
  const stopOther = subscribeRealtimeInvalidation("other", unrelated)
  try {
    await withRealtimeMutations(async () => {
      recordRealtimeMutation("room")
      recordRealtimeMutation("room")
      expect(wake).not.toHaveBeenCalled()
      return new Response(null, { status: 201 })
    })
    expect(wake).toHaveBeenCalledOnce()
    expect(unrelated).not.toHaveBeenCalled()
  } finally { stop(); stopOther() }
  invalidateRealtimeConversation("room")
  expect(wake).toHaveBeenCalledOnce()
})

it("does not wake sockets for rolled back or unsuccessful requests", async () => {
  const wake = vi.fn()
  const stop = subscribeRealtimeInvalidation("rollback", wake)
  try {
    await expect(withRealtimeMutations(async () => {
      recordRealtimeMutation("rollback")
      throw new Error("rollback")
    })).rejects.toThrow("rollback")
    await withRealtimeMutations(async () => {
      recordRealtimeMutation("rollback")
      return new Response(null, { status: 403 })
    })
    expect(wake).not.toHaveBeenCalled()
  } finally { stop() }
})

it("isolates concurrent request mutation sets", async () => {
  const first = vi.fn(), second = vi.fn()
  const stopA = subscribeRealtimeInvalidation("a", first)
  const stopB = subscribeRealtimeInvalidation("b", second)
  let finish!: () => void
  try {
    const pending = withRealtimeMutations(async () => {
      recordRealtimeMutation("a")
      await new Promise<void>((resolve) => { finish = resolve })
      return new Response()
    })
    await withRealtimeMutations(async () => {
      recordRealtimeMutation("b")
      return new Response()
    })
    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
    finish()
    await pending
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
  } finally { stopA(); stopB() }
})
