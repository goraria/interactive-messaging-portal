import "server-only"
import { sql } from "drizzle-orm"
import { getDatabase } from "@/database"
import {
  chatRows,
  checkConversationAccess,
  requireChatManager,
} from "@/services/helper"
import { createServiceError } from "@/utils/service"
export async function chatDeliveryStatus(
  conversationId: string,
  actorId: string
) {
  const { member } = await checkConversationAccess(
    getDatabase(),
    conversationId,
    actorId
  )
  requireChatManager(member)
  return chatRows(
    sql`SELECT e.id,e.type,d.destination,d.attempts,d.delivered_at AS "deliveredAt",d.last_error AS "lastError" FROM chat_event e JOIN chat_delivery d ON d.event_id=e.id WHERE e.conversation_id=${conversationId}::uuid ORDER BY e.sequence DESC LIMIT 100`
  )
}
export async function retryChatDelivery(
  conversationId: string,
  actorId: string,
  eventId: string
) {
  return getDatabase().transaction(async (tx) => {
    const { member } = await checkConversationAccess(
      tx,
      conversationId,
      actorId,
      true,
      true,
      false
    )
    requireChatManager(member)
    const rows = await chatRows(
      sql`UPDATE chat_delivery d SET attempts=0,available_at=clock_timestamp(),last_error=NULL,lease_token=NULL,lease_until=NULL FROM chat_event e WHERE e.id=d.event_id AND e.id=${eventId}::uuid AND e.conversation_id=${conversationId}::uuid AND d.delivered_at IS NULL AND (d.lease_until IS NULL OR d.lease_until<=clock_timestamp()) RETURNING d.destination`,
      tx
    )
    if (!rows.length) throw createServiceError(409, "delivery_not_retryable")
    return { retried: rows.length }
  })
}
