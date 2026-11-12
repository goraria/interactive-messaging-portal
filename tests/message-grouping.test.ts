import { expect, it } from "vitest"
import { getLastReadBlockIndex, shouldShowHeader, shouldShowFooter } from "@/utils/conversation"
it("keeps different people with the same name in separate avatar groups", () => {
  const rows = [
    { user: { id: "a", name: "Alex" }, createdAt: "2026-11-11T12:00:00Z" },
    { user: { id: "b", name: "Alex" }, createdAt: "2026-11-11T12:00:01Z" },
  ]
  expect(shouldShowHeader(rows, 1)).toBe(true)
})

it("shows metadata only at the end of each sender/time group", () => {
  const rows = [
    { user: { id: "a", name: "Alex" }, createdAt: "2026-11-11T12:00:00Z" },
    { user: { id: "a", name: "Alex" }, createdAt: "2026-11-11T12:00:01Z" },
    { user: { id: "a", name: "Alex" }, createdAt: "2026-11-11T12:00:02Z" },
    { user: { id: "b", name: "Alex" }, createdAt: "2026-11-11T12:00:03Z" },
    { user: { id: "b", name: "Alex" }, createdAt: "2026-11-11T12:06:04Z" },
  ]
  expect(rows.map((_, index) => shouldShowFooter(rows, index))).toEqual([false, false, true, true, true])
  expect(shouldShowFooter([], 0)).toBe(false)
})
it("groups one sender by identity, even if their display name was updated", () => {
  const rows = [
    { user: { id: "a", name: "Before" }, createdAt: "2026-11-11T12:00:00Z" },
    { user: { id: "a", name: "After" }, createdAt: "2026-11-11T12:00:01Z" },
  ]
  expect(shouldShowHeader(rows, 1)).toBe(false)
})

it("moves the sole Read marker to the latest fully read outgoing block", () => {
  const row = (sender: string, minute: number, read = false) => ({
    user: { id: sender, name: sender },
    createdAt: new Date(Date.UTC(2026, 10, 11, 12, minute)).toISOString(),
    receipts: read ? [{ userId: "partner", status: "read" }] : [],
  })
  const rows = [row("me", 0, true), row("partner", 1), row("me", 2, true),
    row("me", 3, true), row("partner", 4), row("me", 5)]
  expect(getLastReadBlockIndex(rows, "me")).toBe(3)
  rows[5]!.receipts = [{ userId: "partner", status: "read" }]
  expect(getLastReadBlockIndex(rows, "me")).toBe(5)
})

it("keeps Read on the earlier block until the new block's last message is read", () => {
  const rows = [
    { user: { id: "me", name: "Me" }, createdAt: "2026-11-11T12:00:00Z", receipts: [{ userId: "partner", status: "read" }] },
    { user: { id: "partner", name: "Partner" }, createdAt: "2026-11-11T12:01:00Z", receipts: [] },
    { user: { id: "me", name: "Me" }, createdAt: "2026-11-11T12:02:00Z", receipts: [{ userId: "partner", status: "read" }] },
    { user: { id: "me", name: "Me" }, createdAt: "2026-11-11T12:03:00Z", receipts: [] },
  ]
  expect(getLastReadBlockIndex(rows, "me")).toBe(0)
  expect(getLastReadBlockIndex([], "me")).toBe(-1)
  expect(getLastReadBlockIndex(rows)).toBe(-1)
  rows[0]!.receipts = [{ userId: "me", status: "read" }]
  expect(getLastReadBlockIndex(rows, "me")).toBe(-1)
})
