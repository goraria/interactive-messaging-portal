import { beforeEach, expect, it, vi } from "vitest"
import { PgDialect } from "drizzle-orm/pg-core"
const state = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock("@/database", () => ({
  getDatabase: () => ({ execute: state.execute }),
}))
import {
  rawPublishConversationEvent,
  rawReadConversationSignal,
} from "@/services/realtime"
const dialect = new PgDialect()
beforeEach(() => state.execute.mockReset())
it("publishes durably only with the owning dispatcher lease", async () => {
  state.execute.mockResolvedValue([{ event_id: "event" }])
  await rawPublishConversationEvent("event", "lease")
  const query = dialect.sqlToQuery(state.execute.mock.calls[0]![0])
  expect(query.sql).toContain("delivered_at=clock_timestamp()")
  expect(query.sql).toContain("lease_token=")
  expect(query.sql).toContain("destination='realtime'")
  expect(query.params).toEqual(["event", "lease"])
  state.execute.mockResolvedValue([])
  await expect(
    rawPublishConversationEvent("event", "old-lease")
  ).rejects.toMatchObject({ statusCode: 409 })
})
it("reads committed events immediately without waiting for outbox delivery, with active membership checks", async () => {
  state.execute.mockResolvedValue([{ sequence: "42" }])
  expect(await rawReadConversationSignal("room", "member")).toBe("42")
  const query = dialect.sqlToQuery(state.execute.mock.calls[0]![0])
  for (const predicate of [
    "e.created_at>=m.joined_at",
    "m.left_at IS NULL",
    "u.status='active'",
    "u.deleted_at IS NULL",
    "u.ban_expires<=now()",
  ])
    expect(query.sql).toContain(predicate)
  expect(query.params).toEqual(["room", "member"])
  expect(query.sql).not.toContain("chat_delivery")
  state.execute.mockResolvedValue([])
  await expect(rawReadConversationSignal("room", "removed")).rejects.toMatchObject(
    { statusCode: 403 }
  )
})
