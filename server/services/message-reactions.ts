import { eq } from "drizzle-orm"
import { database } from "@/database"
import { messageReactionsTable } from "@/database/schema"
import type { CreateMessageReactionInput } from "@/schemas/chat"
import { toMessageReaction } from "@/lib/utils/chat"
import { createServiceError } from "@/lib/utils/service"

export async function getMessageReactionRow(reactionId: string) {
  try {
    const [reaction] = await database
      .select()
      .from(messageReactionsTable)
      .where(eq(messageReactionsTable.id, reactionId))
      .limit(1)
    if (!reaction) throw createServiceError(404, "reaction_not_found")
    return reaction
  } catch (error) {
    throw error
  }
}

export async function listMessageReactions(messageId: string) {
  try {
    const rows = await database
      .select()
      .from(messageReactionsTable)
      .where(eq(messageReactionsTable.messageId, messageId))
    return rows.map(toMessageReaction)
  } catch (error) {
    throw error
  }
}

export async function createMessageReaction(
  messageId: string,
  input: CreateMessageReactionInput
) {
  try {
    const [reaction] = await database
      .insert(messageReactionsTable)
      .values({
        messageId,
        userId: input.userId,
        emoji: input.emoji,
        createdAt: new Date(),
      })
      .onConflictDoNothing()
      .returning()
    return reaction ? toMessageReaction(reaction) : null
  } catch (error) {
    throw error
  }
}

export async function deleteMessageReaction(reactionId: string) {
  try {
    const [reaction] = await database
      .delete(messageReactionsTable)
      .where(eq(messageReactionsTable.id, reactionId))
      .returning()

    if (!reaction) throw createServiceError(404, "reaction_not_found")
    return toMessageReaction(reaction)
  } catch (error) {
    throw error
  }
}
