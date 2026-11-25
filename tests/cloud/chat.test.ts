import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest"
import { randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
const external = vi.hoisted(() => ({ platform: vi.fn(), publish: vi.fn() }))
vi.mock("@/services/chat-platform", () => ({
  rawChatPlatformRequest: external.platform,
}))
vi.mock("@/services/realtime", async (original) => {
  const actual = await original<typeof import("@/services/realtime")>()
  return { ...actual, rawPublishConversationEvent: async (...args: Parameters<typeof actual.rawPublishConversationEvent>) => {
    await external.publish(...args)
    return actual.rawPublishConversationEvent(...args)
  } }
})
import { getDatabase } from "@/database"
import { rawChatRows, rawCheckConversationAccess } from "@/models/index"
import * as conversations from "@/models/conversation"
import * as messages from "@/models/message"
import * as calls from "@/models/chat-call"
import { rawDispatchChatEvents } from "@/models/chat-delivery"
import { chatPageSchema } from "@/schemas/chat-domain"
import { rawDownloadChatAttachment } from "@/services/chat-media"
import { rawRetryChatDelivery } from "@/models/chat-delivery"
import { conversationDetailsSchema } from "@/schemas/client/chat"
import { messengerMessageSchema } from "@/schemas/client/messenger"

const database = getDatabase()
const users: string[] = []
const conversationIds: string[] = []
let authBefore: unknown
beforeEach(() => {
  external.platform.mockReset().mockResolvedValue({})
  external.publish.mockReset().mockResolvedValue(undefined)
})
beforeAll(async () => {
  authBefore = await rawChatRows(
    sql`SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('user','session','account','verification','revocation','proof','rate_limit') ORDER BY table_name,ordinal_position`
  )
  external.platform.mockResolvedValue({})
  external.publish.mockResolvedValue(undefined)
})
afterAll(async () => {
  if (conversationIds.length)
    await database.execute(
      sql`DELETE FROM conversation WHERE id IN (${sql.join(
        conversationIds.map((id) => sql`${id}::uuid`),
        sql`,`
      )})`
    )
  if (users.length)
    await database.execute(
      sql`DELETE FROM "user" WHERE id IN (${sql.join(
        users.map((id) => sql`${id}::uuid`),
        sql`,`
      )})`
    )
  const remaining = users.length
    ? await rawChatRows(
        sql`SELECT id FROM "user" WHERE id IN (${sql.join(
          users.map((id) => sql`${id}::uuid`),
          sql`,`
        )})`
      )
    : []
  expect(remaining).toEqual([])
  expect(
    await rawChatRows(
      sql`SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('user','session','account','verification','revocation','proof','rate_limit') ORDER BY table_name,ordinal_position`
    )
  ).toEqual(authBefore)
  console.log("Chat cloud fixtures removed; authentication schema unchanged.")
  await database.$client.end()
})
async function person() {
  const id = randomUUID()
  await database.execute(
    sql`INSERT INTO "user"(id,external_user_id,name,email) VALUES(${id}::uuid,${"chat-test-" + id},'Chat test',${id + "@example.test"})`
  )
  users.push(id)
  return id
}
async function fixture(type: "direct" | "group" = "group") {
  const owner = await person(),
    member = await person(),
    outsider = await person()
  const conversation = await conversations.rawStartChatConversation(owner, {
    type,
    title: "Fixture",
    participantIds: [member],
  })
  const id = String(conversation!.id)
  conversationIds.push(id)
  return { id, owner, member, outsider }
}
async function send(
  id: string,
  user: string,
  content = "hello",
  clientMessageId = randomUUID()
) {
  return messages.rawSendChatMessage(id, user, "chat-test-" + user, {
    content,
    clientMessageId,
    assetIds: [],
  })
}
it("creates owner/member atomically and denies outsider reads and writes", async () => {
  const f = await fixture()
  expect(
    (await conversations.rawListChatMembers(f.id, f.owner)).filter(
      (row) => !row.leftAt
    )
  ).toHaveLength(2)
  await expect(
    rawCheckConversationAccess(database, f.id, f.outsider)
  ).rejects.toMatchObject({ statusCode: 403 })
  await expect(send(f.id, f.outsider)).rejects.toMatchObject({
    statusCode: 403,
  })
})
it("serializes real conversation and message rows to the browser contract", async () => {
  const f = await fixture()
  const message = await send(f.id, f.owner)
  const detail = await conversations.rawGetChatConversation(f.id, f.member)
  expect(
    conversationDetailsSchema.parse(JSON.parse(JSON.stringify(detail))).members
  ).toHaveLength(2)
  expect(
    messengerMessageSchema.parse(JSON.parse(JSON.stringify(message))).user.id
  ).toBe("chat-test-" + f.owner)
})
it("deduplicates concurrent direct-conversation creation", async () => {
  const a = await person(),
    b = await person()
  const input = { type: "direct" as const, participantIds: [b] }
  const [first, second] = await Promise.all([
    conversations.rawStartChatConversation(a, input),
    conversations.rawStartChatConversation(a, input),
  ])
  conversationIds.push(String(first!.id))
  expect(first!.id).toBe(second!.id)
})
it("does not allow admin to promote another admin or remove an owner", async () => {
  const f = await fixture()
  await conversations.rawChangeChatMember(f.id, f.owner, f.member, "role", "admin")
  await expect(
    conversations.rawChangeChatMember(f.id, f.member, f.owner, "remove")
  ).rejects.toMatchObject({ statusCode: 403 })
  await expect(
    conversations.rawChangeChatMember(f.id, f.member, f.outsider, "add", "owner")
  ).rejects.toMatchObject({ statusCode: 403 })
})
it("requires ownership transfer before owner leaves and keeps exactly one owner", async () => {
  const f = await fixture()
  await expect(
    conversations.rawChangeChatMember(f.id, f.owner, f.owner, "remove")
  ).rejects.toMatchObject({ code: "transfer_ownership_first" })
  await conversations.rawChangeChatMember(f.id, f.owner, f.member, "role", "owner")
  await conversations.rawChangeChatMember(f.id, f.owner, f.owner, "remove")
  expect(
    (await conversations.rawListChatMembers(f.id, f.member)).filter(
      (row) => row.role === "owner" && !row.leftAt
    )
  ).toHaveLength(1)
})
it("revokes reads/writes after removal and excludes prior history after rejoining", async () => {
  const f = await fixture()
  const old = await send(f.id, f.owner)
  await conversations.rawChangeChatMember(f.id, f.owner, f.member, "remove")
  await expect(messages.rawGetChatMessage(old.id, f.member)).rejects.toMatchObject(
    { statusCode: 404 }
  )
  await expect(send(f.id, f.member)).rejects.toMatchObject({ statusCode: 403 })
  await conversations.rawChangeChatMember(f.id, f.owner, f.member, "add")
  await expect(messages.rawGetChatMessage(old.id, f.member)).rejects.toMatchObject(
    { statusCode: 404 }
  )
  expect(
    (await messages.rawListChatMessages(f.id, f.member, chatPageSchema.parse({})))
      .data
  ).toHaveLength(0)
})
it("stores one message and one event for concurrent retries; rejects changed payload", async () => {
  const f = await fixture(),
    key = randomUUID()
  const [a, b] = await Promise.all([
    send(f.id, f.owner, "once", key),
    send(f.id, f.owner, "once", key),
  ])
  expect(a.id).toBe(b.id)
  expect(
    await rawChatRows(
      sql`SELECT id FROM chat_event WHERE entity_id=${a.id}::uuid AND type='message.created'`
    )
  ).toHaveLength(1)
  await expect(send(f.id, f.owner, "different", key)).rejects.toMatchObject({
    statusCode: 409,
  })
})
it("has stable cursor ordering with tied timestamps and microseconds", async () => {
  const f = await fixture()
  for (let i = 0; i < 7; i++)
    await database.execute(
      sql`INSERT INTO message(conversation_id,sender_id,content,created_at) VALUES(${f.id}::uuid,${f.owner}::uuid,${"item " + i},${"2090-01-01T00:00:00.123456"}::timestamp)`
    )
  const seen: string[] = []
  let before: string | undefined
  do {
    const page = await messages.rawListChatMessages(
      f.id,
      f.member,
      chatPageSchema.parse({ limit: 2, before })
    )
    seen.push(...page.data.map((row) => row.id))
    before = page.pagination.nextCursor ?? undefined
  } while (before)
  expect(seen).toHaveLength(7)
  expect(new Set(seen).size).toBe(7)
})
it("confines text search to current conversation and membership", async () => {
  const f = await fixture(),
    other = await fixture()
  await send(f.id, f.owner, "needle")
  await send(other.id, other.owner, "needle")
  const page = await messages.rawListChatMessages(
    f.id,
    f.member,
    chatPageSchema.parse({ q: "needle" })
  )
  expect(page.data).toHaveLength(1)
  expect(page.data[0]!.conversationId).toBe(f.id)
})
it("detects concurrent edits with optimistic versions and protects sender ownership", async () => {
  const f = await fixture(),
    message = await send(f.id, f.owner)
  await expect(
    messages.rawEditChatMessage(message.id, f.member, "hijack", 1)
  ).rejects.toMatchObject({ statusCode: 403 })
  const changes = await Promise.allSettled([
    messages.rawEditChatMessage(message.id, f.owner, "first", 1),
    messages.rawEditChatMessage(message.id, f.owner, "second", 1),
  ])
  expect(changes.filter((row) => row.status === "fulfilled")).toHaveLength(1)
  expect(changes.filter((row) => row.status === "rejected")).toHaveLength(1)
})
it("redacts deletion, blocks attachment reads and does not resurrect content", async () => {
  const f = await fixture(),
    message = await send(f.id, f.owner, "private content")
  const deleted = await messages.rawDeleteChatMessage(message.id, f.owner)
  expect(deleted.content).toBe("")
  expect(deleted.metadata).toEqual({})
  expect(deleted.attachments).toEqual([])
  await expect(
    messages.rawEditChatMessage(message.id, f.owner, "restore", 2)
  ).rejects.toMatchObject({ code: "message_deleted" })
})
it("makes reactions idempotent and scopes removal to the caller", async () => {
  const f = await fixture(),
    message = await send(f.id, f.owner)
  await messages.rawReactChatMessage(message.id, f.member, "👍")
  await messages.rawReactChatMessage(message.id, f.member, "👍")
  await messages.rawReactChatMessage(message.id, f.owner, "👍", true)
  expect(
    await rawChatRows(
      sql`SELECT id FROM message_reaction WHERE message_id=${message.id}::uuid`
    )
  ).toHaveLength(1)
  await messages.rawReactChatMessage(message.id, f.member, "👍", true)
  expect(
    await rawChatRows(
      sql`SELECT id FROM message_reaction WHERE message_id=${message.id}::uuid`
    )
  ).toHaveLength(0)
})
it("keeps read receipts and unread cursor monotonic across devices", async () => {
  const f = await fixture(),
    a = await send(f.id, f.owner, "a"),
    b = await send(f.id, f.owner, "b")
  await messages.rawAcknowledgeChatMessage(b.id, f.member, "read")
  await messages.rawAcknowledgeChatMessage(a.id, f.member, "read")
  await messages.rawAcknowledgeChatMessage(b.id, f.member, "delivered")
  const [membership] = await rawChatRows(
    sql`SELECT last_read_message_id FROM conversation_member WHERE conversation_id=${f.id}::uuid AND user_id=${f.member}::uuid`
  )
  expect(membership!.last_read_message_id).toBe(b.id)
  const [receipt] = await rawChatRows(
    sql`SELECT status FROM message_receipt WHERE message_id=${b.id}::uuid AND user_id=${f.member}::uuid`
  )
  expect(receipt!.status).toBe("read")
  expect(
    (await conversations.rawGetChatConversation(f.id, f.member)).unreadCount
  ).toBe(0)
})
it("blocks both communication directions and unblocks only the caller policy", async () => {
  const f = await fixture("direct")
  await conversations.rawSetChatBlock(f.member, f.owner, true)
  await expect(send(f.id, f.owner)).rejects.toMatchObject({
    code: "communication_blocked",
  })
  await expect(
    calls.rawStartChatCall(f.id, f.owner, "audio", randomUUID())
  ).rejects.toMatchObject({ code: "communication_blocked" })
  await conversations.rawSetChatBlock(f.owner, f.member, false)
  await expect(send(f.id, f.owner)).rejects.toMatchObject({
    code: "communication_blocked",
  })
  await conversations.rawSetChatBlock(f.member, f.owner, false)
  expect((await send(f.id, f.owner)).id).toBeTruthy()
})
it("does not let a block prevent group administration or a member leaving", async () => {
  const f = await fixture()
  await conversations.rawSetChatBlock(f.member, f.owner, true)
  await conversations.rawSetChatMute(f.id, f.member, new Date(Date.now() + 10000))
  await conversations.rawChangeChatMember(f.id, f.member, f.member, "remove")
  await expect(
    rawCheckConversationAccess(database, f.id, f.member)
  ).rejects.toMatchObject({ statusCode: 403 })
  await conversations.rawChangeChatConversation(f.id, f.owner, { archived: true })
})
it("allows archive restore without deleting historical messages", async () => {
  const f = await fixture()
  const message = await send(f.id, f.owner)
  await conversations.rawChangeChatConversation(f.id, f.owner, { archived: true })
  await expect(send(f.id, f.owner)).rejects.toMatchObject({
    code: "conversation_archived",
  })
  await conversations.rawChangeChatConversation(f.id, f.owner, { archived: false })
  expect((await messages.rawGetChatMessage(message.id, f.member)).id).toBe(
    message.id
  )
})
it("guards call state transitions, participant identity and replay idempotency", async () => {
  const f = await fixture("direct"),
    key = randomUUID()
  const call = await calls.rawStartChatCall(f.id, f.owner, "audio", key)
  expect((await calls.rawStartChatCall(f.id, f.owner, "audio", key)).id).toBe(
    call.id
  )
  const callId = String(call.id)
  await expect(
    calls.rawSignalChatCall(callId, f.owner, {
      clientId: randomUUID(),
      kind: "accept",
      payload: "",
    })
  ).rejects.toMatchObject({ code: "callee_required" })
  await expect(
    calls.rawListChatSignals(callId, f.outsider, "0")
  ).rejects.toMatchObject({ statusCode: 404 })
  const accept = {
    clientId: randomUUID(),
    kind: "accept" as const,
    payload: "",
  }
  await calls.rawSignalChatCall(callId, f.member, accept)
  await calls.rawSignalChatCall(callId, f.member, accept)
  await calls.rawSignalChatCall(callId, f.owner, {
    clientId: randomUUID(),
    kind: "offer",
    payload: "fixture-sdp",
  })
  const events = await calls.rawListChatSignals(callId, f.member, "0")
  expect(events.data).toHaveLength(1)
  await calls.rawSignalChatCall(callId, f.member, {
    clientId: randomUUID(),
    kind: "end",
    payload: "",
  })
  expect((await calls.rawListChatSignals(callId, f.owner, "0")).state).toBe(
    "ended"
  )
})
it("retains a persisted message and retryable delivery when realtime publish fails", async () => {
  const f = await fixture(),
    message = await send(f.id, f.owner)
  external.publish.mockRejectedValue(new Error("fixture outage"))
  // Restrict this batch to this test's event; no pre-existing outbox rows are touched.
  const event = await rawChatRows<{ id: string }>(
    sql`SELECT id FROM chat_event WHERE entity_id=${message.id}::uuid AND type='message.created'`
  )
  // Dispatch selection is scoped in the API used by this integration test.
  const result = await rawDispatchChatEvents(event[0]!.id)
  expect(result.failed).toBeGreaterThan(0)
  expect((await messages.rawGetChatMessage(message.id, f.member)).content).toBe(
    "hello"
  )
  const [delivery] = await rawChatRows(
    sql`SELECT delivered_at,attempts FROM chat_delivery WHERE event_id=${event[0]!.id}::uuid AND destination='realtime'`
  )
  expect(delivery!.delivered_at).toBeNull()
  expect(delivery!.attempts).toBe(1)
  external.publish.mockResolvedValue(undefined)
  await database.execute(
    sql`UPDATE chat_delivery SET available_at=now() WHERE event_id=${event[0]!.id}::uuid AND delivered_at IS NULL`
  )
  await rawDispatchChatEvents(event[0]!.id)
  const [retried] = await rawChatRows(
    sql`SELECT delivered_at FROM chat_delivery WHERE event_id=${event[0]!.id}::uuid AND destination='realtime'`
  )
  expect(retried!.delivered_at).not.toBeNull()
})
it("binds only Media-validated private assets and checks membership on download", async () => {
  const f = await fixture(),
    assetId = randomUUID()
  external.platform.mockResolvedValue({
    id: assetId,
    filename: "safe.png",
    contentType: "image/png",
    size: 200,
  })
  const message = await messages.rawSendChatMessage(
    f.id,
    f.owner,
    "chat-test-" + f.owner,
    {
      clientMessageId: randomUUID(),
      content: "attachment",
      assetIds: [assetId],
    }
  )
  const attachment = (message.attachments as { id: string }[])[0]!
  expect(attachment.id).toBeTruthy()
  await expect(
    messages.rawSendChatMessage(f.id, f.owner, "chat-test-" + f.owner, {
      clientMessageId: randomUUID(),
      content: "duplicate binding",
      assetIds: [assetId],
    })
  ).rejects.toMatchObject({ code: "asset_already_bound" })
  external.platform.mockResolvedValue({
    url: "https://storage.example.test/signed",
    expiresIn: 60,
  })
  expect(await rawDownloadChatAttachment(attachment.id, f.member)).toMatchObject({
    expiresIn: 60,
  })
  await conversations.rawChangeChatMember(f.id, f.owner, f.member, "remove")
  external.platform.mockClear()
  await expect(
    rawDownloadChatAttachment(attachment.id, f.member)
  ).rejects.toMatchObject({ statusCode: 403 })
  expect(external.platform).not.toHaveBeenCalled()
  await messages.rawDeleteChatMessage(message.id, f.owner)
  await expect(
    rawDownloadChatAttachment(attachment.id, f.owner)
  ).rejects.toMatchObject({ statusCode: 404 })
})
it("does not persist a message when Media rejects a foreign or unsafe asset", async () => {
  const f = await fixture()
  external.platform.mockRejectedValue(new Error("media rejected"))
  await expect(
    messages.rawSendChatMessage(f.id, f.owner, "chat-test-" + f.owner, {
      clientMessageId: randomUUID(),
      content: "unsafe",
      assetIds: [randomUUID()],
    })
  ).rejects.toThrow()
  expect(
    await rawChatRows(
      sql`SELECT id FROM message WHERE conversation_id=${f.id}::uuid`
    )
  ).toHaveLength(0)
})
it("enforces a durable sender rate limit", async () => {
  const f = await fixture()
  await database.execute(
    sql`INSERT INTO message(conversation_id,sender_id,content) SELECT ${f.id}::uuid,${f.owner}::uuid,'rate fixture' FROM generate_series(1,30)`
  )
  await expect(send(f.id, f.owner)).rejects.toMatchObject({ statusCode: 429 })
})
it("fences a stale dispatcher ACK after its lease has been replaced", async () => {
  const f = await fixture(),
    message = await send(f.id, f.owner),
    replacement = randomUUID()
  const [event] = await rawChatRows<{ id: string }>(
    sql`SELECT id FROM chat_event WHERE entity_id=${message.id}::uuid AND type='message.created'`
  )
  external.publish.mockImplementation(async () => {
    await database.execute(
      sql`UPDATE chat_delivery SET lease_token=${replacement}::uuid WHERE event_id=${event!.id}::uuid AND destination='realtime'`
    )
  })
  await rawDispatchChatEvents(event!.id)
  const [delivery] = await rawChatRows(
    sql`SELECT delivered_at,lease_token FROM chat_delivery WHERE event_id=${event!.id}::uuid AND destination='realtime'`
  )
  expect(delivery!.delivered_at).toBeNull()
  expect(delivery!.lease_token).toBe(replacement)
})
it("keeps destination retries independent and protects manual retry from viewers", async () => {
  const f = await fixture(),
    message = await send(f.id, f.owner)
  const [event] = await rawChatRows<{ id: string }>(
    sql`SELECT id FROM chat_event WHERE entity_id=${message.id}::uuid AND type='message.created'`
  )
  external.platform.mockImplementation(async (domain) => {
    if (domain === "notification") throw new Error("notify down")
    return {}
  })
  await rawDispatchChatEvents(event!.id)
  const states = await rawChatRows(
    sql`SELECT destination,delivered_at FROM chat_delivery WHERE event_id=${event!.id}::uuid`
  )
  expect(
    states.find((row) => row.destination === "notification")!.delivered_at
  ).toBeNull()
  expect(
    states.find((row) => row.destination === "realtime")!.delivered_at
  ).not.toBeNull()
  expect(
    states.find((row) => row.destination === "insight")!.delivered_at
  ).not.toBeNull()
  await expect(
    rawRetryChatDelivery(f.id, f.member, event!.id)
  ).rejects.toMatchObject({ statusCode: 403 })
  expect(await rawRetryChatDelivery(f.id, f.owner, event!.id)).toEqual({
    retried: 1,
  })
})
