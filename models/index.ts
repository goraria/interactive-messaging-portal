import "server-only"
import { sql, type SQL } from "drizzle-orm"
import { getDatabase, type Database } from "@/database"
import { createServiceError } from "@/utils/service"
import { type ChatMembership } from "@/schemas/chat-domain"
import { recordRealtimeMutation } from "@/lib/realtime/mutation"
import { measureRequest } from "@/utils/server/timing"

export type ChatTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

export async function rawChatRows<T extends Record<string, unknown>>(
  query: SQL,
  tx: Pick<Database, "execute"> | ChatTransaction = getDatabase(),
): Promise<T[]> {
  return Array.from(
    await measureRequest("chat_db", () => tx.execute(query)),
  ) as T[];
}

export function rawCheckCurrentConversationAccess(conversationId: string, userId: string) {
  return rawCheckConversationAccess(getDatabase(), conversationId, userId);
}

export async function rawCheckConversationAccess(
  tx: ChatTransaction | Database,
  conversationId: string,
  userId: string,
  write = false,
  allowArchived = false,
  communication = true,
) {
  // Every mutation locks the conversation before checking membership. Removal and
  // writes serialize on the same row, so an old controller check cannot race a kick.
  const [conversation] = await rawChatRows(
    sql`SELECT id, type, archived_at FROM conversation WHERE id=${conversationId}::uuid ${write ? sql`FOR UPDATE` : sql``}`,
    tx,
  );
  if (!conversation) throw createServiceError(404, "conversation_not_found");
  const [member] = await rawChatRows<ChatMembership>(
    sql`SELECT * FROM conversation_member WHERE conversation_id=${conversationId}::uuid AND user_id=${userId}::uuid AND left_at IS NULL`,
    tx,
  );
  if (!member) throw createServiceError(403, "conversation_forbidden");
  if (write && conversation.archived_at && !allowArchived)
    throw createServiceError(409, "conversation_archived");
  if (write && communication) {
    const [blocked] = await rawChatRows(
      sql`SELECT 1 FROM chat_block b JOIN conversation_member m ON m.conversation_id=${conversationId}::uuid AND m.left_at IS NULL WHERE (b.user_id=${userId}::uuid AND b.target_id=m.user_id) OR (b.target_id=${userId}::uuid AND b.user_id=m.user_id) LIMIT 1`,
      tx,
    );
    if (blocked) throw createServiceError(403, "communication_blocked");
  }
  return { conversation, member };
}

export function rawRequireChatManager(member: ChatMembership) {
  if (!["owner", "admin"].includes(member.role))
    throw createServiceError(403, "conversation_manager_required");
}

export async function rawCheckMessageAccess(
  messageId: string,
  userId: string,
  tx: ChatTransaction | Database = getDatabase(),
  write = false,
) {
  let [message] = await rawChatRows(
    sql`SELECT * FROM message WHERE id=${messageId}::uuid`,
    tx,
  );
  if (!message) throw createServiceError(404, "message_not_found");
  const access = await rawCheckConversationAccess(
    tx,
    String(message.conversation_id),
    userId,
    write,
  );
  if (write) {
    const [current] = await rawChatRows(
      sql`SELECT * FROM message WHERE id=${messageId}::uuid`,
      tx,
    );
    if (!current) throw createServiceError(404, "message_not_found");
    message = current;
  }
  if (new Date(String(message.created_at)) < new Date(access.member.joined_at))
    throw createServiceError(404, "message_not_found");
  return { ...access, message };
}

export async function rawAppendChatEvent(
  tx: ChatTransaction,
  conversationId: string,
  actorId: string,
  type: string,
  entityId: string,
) {
  const destinations = [
    "realtime",
    "insight",
    ...(type === "message.created" ? ["notification"] : []),
    ...(type.startsWith("message.") ? ["discovery"] : []),
  ];
  const [event] = await rawChatRows<{ id: string }>(
    sql`WITH event AS (
      INSERT INTO chat_event(conversation_id,actor_id,type,entity_id)
      VALUES(${conversationId}::uuid,${actorId}::uuid,${type},${entityId}::uuid) RETURNING id
    ), deliveries AS (
      INSERT INTO chat_delivery(event_id,destination)
      SELECT event.id, target.destination FROM event
      CROSS JOIN (VALUES ${sql.join(
        destinations.map((destination) => sql`(${destination}::text)`),
        sql`,`,
      )}) AS target(destination)
    ) SELECT id FROM event`,
    tx,
  );
  if (!event) throw createServiceError(500, "event_create_failed");
  recordRealtimeMutation(conversationId);
  return event.id;
}
