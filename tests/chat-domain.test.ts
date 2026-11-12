import { expect, it } from "vitest"
import {
  callSignalSchema,
  sendChatMessageSchema,
  startConversationSchema,
  uploadInputSchema,
  chatPageSchema,
} from "@/schemas/chat-domain"
import {
  canManageMember,
  readChatCursor,
  writeChatCursor,
} from "@/utils/chat-policy"
const id = "4e491a43-7b0b-4d74-b3a2-ae18224b2155"
it("bounds input and requires a server-side idempotency key", () => {
  expect(sendChatMessageSchema.safeParse({ content: "hello" }).success).toBe(
    false
  )
  expect(
    sendChatMessageSchema.safeParse({ clientMessageId: id, content: " " })
      .success
  ).toBe(false)
  expect(
    sendChatMessageSchema.safeParse({
      clientMessageId: id,
      content: "",
      assetIds: [id],
    }).success
  ).toBe(true)
  expect(
    sendChatMessageSchema.safeParse({
      clientMessageId: id,
      content: "x".repeat(4001),
    }).success
  ).toBe(false)
  expect(
    startConversationSchema.safeParse({ participantIds: Array(100).fill(id) })
      .success
  ).toBe(false)
})
it("excludes executable/vector uploads, arbitrary remote URLs and oversized objects", () => {
  const input = {
    bucket: id,
    filename: "document.pdf",
    contentType: "application/pdf",
    size: 100,
  }
  expect(uploadInputSchema.safeParse(input).success).toBe(true)
  for (const contentType of [
    "text/html",
    "image/svg+xml",
    "application/javascript",
  ])
    expect(uploadInputSchema.safeParse({ ...input, contentType }).success).toBe(
      false
    )
  expect(
    uploadInputSchema.safeParse({ ...input, size: 26 * 1024 * 1024 }).success
  ).toBe(false)
})
it("preserves cursor microseconds and rejects malformed cursor values", () => {
  const input = { id, createdAt: "2026-10-28T12:01:02.123456Z" }
  expect(readChatCursor(writeChatCursor(input))).toEqual(input)
  expect(() => readChatCursor("invalid")).toThrow("invalid_message_cursor")
  expect(chatPageSchema.safeParse({ limit: 101 }).success).toBe(false)
})
it("does not let admins promote peers, manage owners, or assign owner", () => {
  expect(canManageMember("member", "member", "member")).toBe(false)
  expect(canManageMember("admin", "admin", "member")).toBe(false)
  expect(canManageMember("admin", "owner")).toBe(false)
  expect(canManageMember("admin", "member", "owner")).toBe(false)
  expect(canManageMember("owner", "admin", "member")).toBe(true)
})
it("bounds call signaling independently of message bodies", () => {
  expect(
    callSignalSchema.safeParse({
      clientId: id,
      kind: "ice",
      payload: "x".repeat(65537),
    }).success
  ).toBe(false)
})
