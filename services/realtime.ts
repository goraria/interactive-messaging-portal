import "server-only"
import { sql } from "drizzle-orm"
import { chatRows } from "@/services/helper"
import { createServiceError } from "@/utils/service"
import { conversationSocketPath } from "@/utils/realtime"

export async function createConversationToken(conversationId: string) {
  // Preserve the existing HTTP endpoint; no OAuth token is returned to JavaScript.
  // The WebSocket handshake independently authenticates the HttpOnly app session.
  return {
    url: conversationSocketPath(conversationId),
    transport: "websocket" as const,
  }
}

export async function publishConversationEvent(eventId: string, lease: string) {
  // Retain durable delivery accounting/retry. Sockets can already observe the
  // committed chat_event without waiting for this background acknowledgement.
  const [published] = await chatRows(
    sql`UPDATE chat_delivery SET delivered_at=clock_timestamp(),lease_token=NULL,lease_until=NULL,last_error=NULL WHERE event_id=${eventId}::uuid AND destination='realtime' AND lease_token=${lease}::uuid RETURNING event_id`
  )
  if (!published) throw createServiceError(409, "realtime_delivery_lease_lost")
}

export async function readConversationSignal(
  conversationId: string,
  userId: string
) {
  const [row] = await chatRows<{ sequence: string }>(sql`
    SELECT COALESCE((SELECT e.sequence FROM chat_event e WHERE e.conversation_id=m.conversation_id AND e.created_at>=m.joined_at ORDER BY e.sequence DESC LIMIT 1),0)::text AS sequence
    FROM conversation_member m JOIN "user" u ON u.id=m.user_id
    WHERE m.conversation_id=${conversationId}::uuid AND m.user_id=${userId}::uuid
      AND m.left_at IS NULL AND u.status='active' AND u.deleted_at IS NULL
      AND (u.banned_at IS NULL OR (u.ban_expires IS NOT NULL AND u.ban_expires<=now()))
  `)
  if (!row) throw createServiceError(403, "conversation_forbidden")
  return row.sequence
}

