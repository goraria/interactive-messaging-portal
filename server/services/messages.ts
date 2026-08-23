import { desc, eq, inArray } from "drizzle-orm"
import { database } from "@/database"
import {
  conversationsTable,
  messagesTable,
  usersTable,
  type ConversationRow,
  type UserRow,
} from "@/database/schema"
import type { CreateRoomMessageInput, UpdateMessageInput } from "@/schemas/chat"
import { toMessage } from "@/lib/utils/chat"
import { createServiceError } from "@/lib/utils/service"
import { touchConversation } from "@/services/conversations"

export async function listConversationMessages(
  conversation: ConversationRow,
  limit: number
) {
  try {
    const rows = await database
      .select({ message: messagesTable, sender: usersTable })
      .from(messagesTable)
      .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
      .where(eq(messagesTable.conversationId, conversation.id))
      .orderBy(desc(messagesTable.createdAt))
      .limit(limit)

    return rows
      .toReversed()
      .map((row) => toMessage(row.message, row.sender, conversation))
  } catch (error) {
    throw error
  }
}

export async function listLastMessagesForConversations(
  conversationIds: string[]
) {
  try {
    if (conversationIds.length === 0) return []
    return await database
      .selectDistinctOn([messagesTable.conversationId], {
        message: messagesTable,
        sender: usersTable,
        conversation: conversationsTable,
      })
      .from(messagesTable)
      .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
      .innerJoin(
        conversationsTable,
        eq(messagesTable.conversationId, conversationsTable.id)
      )
      .where(inArray(messagesTable.conversationId, conversationIds))
      .orderBy(messagesTable.conversationId, desc(messagesTable.createdAt))
  } catch (error) {
    throw error
  }
}

export async function createConversationMessage(
  conversation: ConversationRow,
  user: UserRow,
  input: CreateRoomMessageInput
) {
  try {
    const [message] = await database
      .insert(messagesTable)
      .values({
        conversationId: conversation.id,
        senderId: user.id,
        type: "text",
        content: input.content,
        metadata: input.metadata ?? {},
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    if (!message) throw createServiceError(500, "message_create_failed")
    await touchConversation(conversation)
    return toMessage(message, user, conversation)
  } catch (error) {
    throw error
  }
}

export async function getMessageRow(messageId: string) {
  try {
    const [message] = await database
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.id, messageId))
      .limit(1)
    if (!message) throw createServiceError(404, "message_not_found")
    return message
  } catch (error) {
    throw error
  }
}

export async function getMessage(messageId: string) {
  try {
    const [row] = await database
      .select({
        message: messagesTable,
        sender: usersTable,
        conversation: conversationsTable,
      })
      .from(messagesTable)
      .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
      .innerJoin(
        conversationsTable,
        eq(messagesTable.conversationId, conversationsTable.id)
      )
      .where(eq(messagesTable.id, messageId))
      .limit(1)

    if (!row) throw createServiceError(404, "message_not_found")
    return toMessage(row.message, row.sender, row.conversation)
  } catch (error) {
    throw error
  }
}

export async function updateMessage(
  messageId: string,
  input: UpdateMessageInput
) {
  try {
    const [message] = await database
      .update(messagesTable)
      .set({
        content: input.content,
        type: input.type,
        metadata: input.metadata,
        editedAt: input.content ? new Date() : undefined,
        deletedAt: input.deletedAt,
        updatedAt: new Date(),
      })
      .where(eq(messagesTable.id, messageId))
      .returning()

    if (!message) throw createServiceError(404, "message_not_found")
    return toMessage(message, null, null)
  } catch (error) {
    throw error
  }
}

export async function deleteMessage(messageId: string) {
  try {
    const [message] = await database
      .update(messagesTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(messagesTable.id, messageId))
      .returning()

    if (!message) throw createServiceError(404, "message_not_found")
    return toMessage(message, null, null)
  } catch (error) {
    throw error
  }
}
