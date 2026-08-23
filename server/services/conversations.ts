import { desc, eq, inArray } from "drizzle-orm"
import { database } from "@/database"
import {
  conversationsTable,
  type ConversationRow,
  type UserRow,
} from "@/database/schema"
import type {
  CreateConversationInput,
  UpdateConversationInput,
} from "@/schemas/chat"
import { slugifyConversation, toConversation } from "@/lib/utils/chat"
import { createServiceError } from "@/lib/utils/service"

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function findConversation(identifier: string) {
  try {
    const [conversation] = await database
      .select()
      .from(conversationsTable)
      .where(
        uuidPattern.test(identifier)
          ? eq(conversationsTable.id, identifier)
          : eq(conversationsTable.slug, identifier)
      )
      .limit(1)
    return conversation
  } catch (error) {
    throw error
  }
}

export async function getConversationRow(identifier: string) {
  try {
    const conversation = await findConversation(identifier)
    if (!conversation) {
      throw createServiceError(404, "conversation_not_found")
    }
    return conversation
  } catch (error) {
    throw error
  }
}

export async function listConversationsByIds(
  conversationIds: string[],
  limit: number
) {
  try {
    if (conversationIds.length === 0) return []
    return await database
      .select()
      .from(conversationsTable)
      .where(inArray(conversationsTable.id, conversationIds))
      .orderBy(desc(conversationsTable.updatedAt))
      .limit(limit)
  } catch (error) {
    throw error
  }
}

export async function createConversation(input: CreateConversationInput) {
  try {
    const [conversation] = await database
      .insert(conversationsTable)
      .values({
        slug: slugifyConversation(input.slug || input.title || ""),
        title: input.title,
        type: input.type,
        createdById: input.createdById,
        metadata: input.metadata ?? {},
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    if (!conversation) {
      throw createServiceError(500, "conversation_create_failed")
    }
    return toConversation(conversation)
  } catch (error) {
    throw error
  }
}

export async function updateConversation(
  conversationId: string,
  input: UpdateConversationInput
) {
  try {
    const conversation = await getConversationRow(conversationId)
    const [updated] = await database
      .update(conversationsTable)
      .set({
        slug: input.slug ? slugifyConversation(input.slug) : undefined,
        title: input.title,
        type: input.type,
        metadata: input.metadata,
        archivedAt: input.archivedAt ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(conversationsTable.id, conversation.id))
      .returning()

    if (!updated) throw createServiceError(404, "conversation_not_found")
    return toConversation(updated)
  } catch (error) {
    throw error
  }
}

export async function deleteConversation(conversationId: string) {
  try {
    const conversation = await getConversationRow(conversationId)
    const [deleted] = await database
      .delete(conversationsTable)
      .where(eq(conversationsTable.id, conversation.id))
      .returning()

    if (!deleted) throw createServiceError(404, "conversation_not_found")
    return toConversation(deleted)
  } catch (error) {
    throw error
  }
}

export async function ensureConversation(slug: string, creator?: UserRow) {
  try {
    const existing = await findConversation(slug)
    if (existing) return existing

    const [created] = await database
      .insert(conversationsTable)
      .values({
        slug,
        title: slug,
        type: "direct",
        createdById: creator?.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    if (!created) {
      throw createServiceError(500, "conversation_create_failed")
    }
    return created
  } catch (error) {
    throw error
  }
}

export async function touchConversation(conversation: ConversationRow) {
  try {
    await database
      .update(conversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(conversationsTable.id, conversation.id))
  } catch (error) {
    throw error
  }
}
