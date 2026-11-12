import { expect, it } from "vitest"
import { formatChatTimestamp, formatChatConversation } from "@/utils/formatter"
import { formatChatAmount } from "@/utils/chat-amount"
it("normalizes raw PostgreSQL timestamps and typed driver dates for the browser DTO", () => {
  expect(formatChatTimestamp("2026-10-28 10:00:00.123456")).toBe(
    "2026-10-28T10:00:00.123Z"
  )
  expect(formatChatTimestamp("2026-10-28 10:00:00+00")).toBe(
    "2026-10-28T10:00:00.000Z"
  )
  expect(formatChatTimestamp(new Date("2026-10-28T10:00:00Z"))).toBe(
    "2026-10-28T10:00:00.000Z"
  )
  expect(
    formatChatConversation({
      id: "id",
      createdAt: "2026-10-28 10:00:00",
      updatedAt: "2026-10-28 10:00:00",
      archivedAt: null,
    }).archivedAt
  ).toBeNull()
})
it("uses the currency exponent for minor amounts including zero-decimal VND", () => {
  expect(formatChatAmount(100, "USD")).toBe(
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
    }).format(1)
  )
  expect(formatChatAmount(100, "VND")).toBe(
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "VND",
    }).format(100)
  )
})
