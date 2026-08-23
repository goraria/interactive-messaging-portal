import { eq } from "drizzle-orm"
import { database } from "@/database"
import { messageAttachmentsTable } from "@/database/schema"
import type {
  CreateMessageAttachmentInput,
  UpdateMessageAttachmentInput,
} from "@/schemas/chat"
import { toMessageAttachment } from "@/lib/utils/chat"
import { createServiceError } from "@/lib/utils/service"

export async function getMessageAttachmentRow(attachmentId: string) {
  try {
    const [attachment] = await database
      .select()
      .from(messageAttachmentsTable)
      .where(eq(messageAttachmentsTable.id, attachmentId))
      .limit(1)
    if (!attachment) throw createServiceError(404, "attachment_not_found")
    return attachment
  } catch (error) {
    throw error
  }
}

export async function listMessageAttachments(messageId: string) {
  try {
    const rows = await database
      .select()
      .from(messageAttachmentsTable)
      .where(eq(messageAttachmentsTable.messageId, messageId))
    return rows.map(toMessageAttachment)
  } catch (error) {
    throw error
  }
}

export async function createMessageAttachment(
  messageId: string,
  input: CreateMessageAttachmentInput
) {
  try {
    const [attachment] = await database
      .insert(messageAttachmentsTable)
      .values({
        messageId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        metadata: input.metadata ?? {},
        createdAt: new Date(),
      })
      .returning()

    if (!attachment) {
      throw createServiceError(500, "attachment_create_failed")
    }
    return toMessageAttachment(attachment)
  } catch (error) {
    throw error
  }
}

export async function updateMessageAttachment(
  attachmentId: string,
  input: UpdateMessageAttachmentInput
) {
  try {
    const [attachment] = await database
      .update(messageAttachmentsTable)
      .set(input)
      .where(eq(messageAttachmentsTable.id, attachmentId))
      .returning()

    if (!attachment) throw createServiceError(404, "attachment_not_found")
    return toMessageAttachment(attachment)
  } catch (error) {
    throw error
  }
}

export async function deleteMessageAttachment(attachmentId: string) {
  try {
    const [attachment] = await database
      .delete(messageAttachmentsTable)
      .where(eq(messageAttachmentsTable.id, attachmentId))
      .returning()

    if (!attachment) throw createServiceError(404, "attachment_not_found")
    return toMessageAttachment(attachment)
  } catch (error) {
    throw error
  }
}
