import "server-only"
import { sql } from "drizzle-orm"
import { chatSearchResultSchema } from "@/schemas/chat-platform"
import { getDatabase } from "@/database"
import { chatRows, checkConversationAccess } from "@/services/helper"
import { chatPlatformRequest } from "@/services/chat-platform"
import { getChatMessage } from "@/services/chat-messages"
export async function searchChatMessages(
  conversationId: string,
  userId: string,
  query: string,
  limit: number
) {
  const { member } = await checkConversationAccess(
    getDatabase(),
    conversationId,
    userId
  )
  const result = chatSearchResultSchema.parse(
    await chatPlatformRequest("discovery", "/discovery/chat/search", "POST", {
      conversationId,
      query,
      joinedAfter: new Date(member.joined_at).toISOString(),
      limit,
    })
  )
  if (!result.data.length) return []
  const allowed = await chatRows<{ id: string }>(
    sql`SELECT m.id FROM message m JOIN conversation_member cm ON cm.conversation_id=m.conversation_id AND cm.user_id=${userId}::uuid AND cm.left_at IS NULL WHERE m.conversation_id=${conversationId}::uuid AND m.created_at>=cm.joined_at AND m.deleted_at IS NULL AND m.id IN (${sql.join(
      result.data.map((row) => sql`${row.resourceId}::uuid`),
      sql`,`
    )}) AND position(lower(${query}) in lower(m.content))>0 ORDER BY m.created_at DESC,m.id DESC LIMIT ${limit}`
  )
  return Promise.all(allowed.map((row) => getChatMessage(row.id, userId)))
}
