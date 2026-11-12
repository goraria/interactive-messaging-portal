import { expect, it } from "vitest"
import { messengerMessageSchema } from "@/schemas/client/messenger"
import { mergeChatMessages } from "@/utils/messenger"
const base = {
  id: "8eac2f8a-6415-452f-aa2e-54286b14fcde",
  conversationId: "8eac2f8a-6415-452f-aa2e-54286b14fcdf",
  content: "text",
  type: "text",
  metadata: {},
  user: { id: "sender", name: "Sender", email: null },
  editedAt: null,
  deletedAt: null,
  createdAt: "2026-10-28T10:00:00.000Z",
  updatedAt: "2026-10-28T10:00:00.000Z",
}
it("does not let an out-of-order receipt/reaction response overwrite newer state", () => {
  const latest = messengerMessageSchema.parse({
    ...base,
    version: 1,
    syncVersion: "9007199254740993",
    receipts: [{ userId: "reader", status: "read" }],
  })
  const stale = messengerMessageSchema.parse({
    ...base,
    version: 1,
    syncVersion: "9007199254740992",
  })
  expect(mergeChatMessages([latest], [stale])[0]!.receipts).toHaveLength(1)
})
it("keeps deletion tombstones over older message deliveries and deduplicates pages", () => {
  const deleted = messengerMessageSchema.parse({
    ...base,
    content: "",
    deletedAt: "2026-10-28T10:01:00.000Z",
    version: 2,
    syncVersion: "10",
  })
  const original = messengerMessageSchema.parse({
    ...base,
    version: 1,
    syncVersion: "1",
  })
  expect(mergeChatMessages([deleted], [original, original])).toEqual([deleted])
})
