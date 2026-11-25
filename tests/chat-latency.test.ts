import { PgDialect } from "drizzle-orm/pg-core"
import type { SQL } from "drizzle-orm"
import { beforeEach, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  execute: vi.fn(), publish: vi.fn(), platform: vi.fn(), jobs: [] as Record<string, unknown>[],
}))
vi.mock("@/database", () => ({ getDatabase: () => ({ execute: state.execute }) }))
vi.mock("@/services/realtime", () => ({ rawPublishConversationEvent: state.publish }))
vi.mock("@/services/chat-platform", () => ({ rawChatPlatformRequest: state.platform }))
vi.mock("@/utils/environment", () => ({ appUrl: "https://chat.example" }))

import { rawAppendChatEvent } from "@/models/index"
import { type ChatTransaction } from "@/models/index"
import { rawDispatchChatEvents } from "@/models/chat-delivery"

const dialect = new PgDialect()
const query = (sql: SQL) => dialect.sqlToQuery(sql)
beforeEach(() => {
  state.jobs = []
  state.execute.mockReset().mockImplementation(async (sql: SQL) => {
    const text = query(sql).sql
    if (text.startsWith("WITH selected")) return state.jobs
    if (text.startsWith("WITH event")) return [{ id: "event-id" }]
    return []
  })
  state.publish.mockReset().mockResolvedValue(undefined)
  state.platform.mockReset()
})

it.each([
  ["message.created", ["realtime", "insight", "notification", "discovery"]],
  ["message.updated", ["realtime", "insight", "discovery"]],
  ["receipt.read", ["realtime", "insight"]],
])("writes %s and all of its outbox destinations atomically in one DB round trip", async (type, destinations) => {
  const tx = { execute: state.execute } as unknown as ChatTransaction
  expect(await rawAppendChatEvent(tx, "conversation", "actor", type, "entity")).toBe("event-id")
  expect(state.execute).toHaveBeenCalledOnce()
  const compiled = query(state.execute.mock.calls[0]![0])
  expect(compiled.sql).toContain("INSERT INTO chat_event")
  expect(compiled.sql).toContain("INSERT INTO chat_delivery")
  expect(compiled.params.slice(4)).toEqual(destinations)
})

it("claims only realtime deliveries on the fast path and publishes no message text", async () => {
  state.jobs = [{ event_id: "event", id: "event", destination: "realtime", attempts: 1,
    conversation_id: "conversation", entity_id: "message", sequence: "42", type: "message.created" }]
  expect(await rawDispatchChatEvents(undefined, "realtime")).toEqual({ claimed: 1, delivered: 1, failed: 0 })
  const claim = query(state.execute.mock.calls[0]![0])
  expect(claim.sql).toContain("AND d.destination=")
  expect(claim.params).toContain("realtime")
  expect(state.publish).toHaveBeenCalledWith("event", expect.any(String))
  expect(state.platform).not.toHaveBeenCalled()
})

it("keeps the realtime outbox retryable when durable WebSocket publication fails", async () => {
  state.jobs = [{ event_id: "event", id: "event", destination: "realtime", attempts: 1,
    conversation_id: "conversation", entity_id: "message", sequence: "42", type: "message.created" }]
  state.publish.mockRejectedValueOnce(new Error("Signal bus offline"))
  expect(await rawDispatchChatEvents(undefined, "realtime")).toEqual({ claimed: 1, delivered: 0, failed: 1 })
  const update = query(state.execute.mock.calls[1]![0])
  expect(update.sql).toContain("available_at=clock_timestamp()")
  expect(update.sql).toContain("lease_token=NULL")
  expect(update.sql).not.toContain("SET delivered_at=")
})
