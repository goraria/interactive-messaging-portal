import { eq } from "drizzle-orm"
import { database } from "@/database"
import { messageReceiptsTable } from "@/database/schema"
import type {
  CreateMessageReceiptInput,
  UpdateMessageReceiptInput,
} from "@/schemas/chat"
import { toMessageReceipt } from "@/lib/utils/chat"
import { createServiceError } from "@/lib/utils/service"

export async function getMessageReceiptRow(receiptId: string) {
  try {
    const [receipt] = await database
      .select()
      .from(messageReceiptsTable)
      .where(eq(messageReceiptsTable.id, receiptId))
      .limit(1)
    if (!receipt) throw createServiceError(404, "receipt_not_found")
    return receipt
  } catch (error) {
    throw error
  }
}

export async function listMessageReceipts(messageId: string) {
  try {
    const rows = await database
      .select()
      .from(messageReceiptsTable)
      .where(eq(messageReceiptsTable.messageId, messageId))
    return rows.map(toMessageReceipt)
  } catch (error) {
    throw error
  }
}

export async function createMessageReceipt(
  messageId: string,
  input: CreateMessageReceiptInput
) {
  try {
    const deliveredAt =
      input.status === "delivered" || input.status === "read"
        ? new Date()
        : undefined
    const readAt = input.status === "read" ? new Date() : undefined
    const [receipt] = await database
      .insert(messageReceiptsTable)
      .values({
        messageId,
        userId: input.userId,
        status: input.status,
        deliveredAt,
        readAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [messageReceiptsTable.messageId, messageReceiptsTable.userId],
        set: {
          status: input.status,
          deliveredAt,
          readAt,
          updatedAt: new Date(),
        },
      })
      .returning()

    if (!receipt) throw createServiceError(500, "receipt_create_failed")
    return toMessageReceipt(receipt)
  } catch (error) {
    throw error
  }
}

export async function updateMessageReceipt(
  receiptId: string,
  input: UpdateMessageReceiptInput
) {
  try {
    const [receipt] = await database
      .update(messageReceiptsTable)
      .set({
        status: input.status,
        deliveredAt: input.deliveredAt,
        readAt: input.readAt,
        updatedAt: new Date(),
      })
      .where(eq(messageReceiptsTable.id, receiptId))
      .returning()

    if (!receipt) throw createServiceError(404, "receipt_not_found")
    return toMessageReceipt(receipt)
  } catch (error) {
    throw error
  }
}

export async function deleteMessageReceipt(receiptId: string) {
  try {
    const [receipt] = await database
      .delete(messageReceiptsTable)
      .where(eq(messageReceiptsTable.id, receiptId))
      .returning()

    if (!receipt) throw createServiceError(404, "receipt_not_found")
    return toMessageReceipt(receipt)
  } catch (error) {
    throw error
  }
}
