import "server-only"
import { createHash } from "node:crypto"
import { sql } from "drizzle-orm"
import { getDatabase } from "@/database"
import { rawAppendChatEvent, rawChatRows, rawCheckConversationAccess, rawCheckMessageAccess, type ChatTransaction } from "@/models/index"
import { chatMessageDetailsProjection, type ChatMessageRecord, type chatPageSchema, type sendChatMessageSchema } from "@/schemas/chat-domain"
import { type z } from "@gorth-com/structure/cores/zod"
import { readChatCursor, writeChatCursor } from "@/utils/chat-policy"
import { createServiceError } from "@/utils/service"
import { rawInspectChatAsset } from "@/services/chat-media"
import { chatSearchResultSchema } from "@/schemas/chat-platform"
import { rawChatPlatformRequest } from "@/services/chat-platform"

export async function rawGetChatMessage(
  messageId: string,
  userId: string,
  tx = getDatabase() as Pick<ChatTransaction, "execute">,
) {
  const [result] = await rawChatRows<ChatMessageRecord>(
    sql`SELECT ${chatMessageDetailsProjection} FROM message m LEFT JOIN "user" u ON u.id=m.sender_id JOIN conversation_member cm ON cm.conversation_id=m.conversation_id AND cm.user_id=${userId}::uuid AND cm.left_at IS NULL WHERE m.id=${messageId}::uuid AND m.created_at>=cm.joined_at`,
    tx,
  );
  if (!result) throw createServiceError(404, "message_not_found");
  return result;
}
export async function rawListChatMessages(
  conversationId: string,
  userId: string,
  input: z.infer<typeof chatPageSchema>,
) {
  await rawCheckConversationAccess(getDatabase(), conversationId, userId);
  const [watermark] = await rawChatRows<{ cursor: string }>(
    sql`SELECT COALESCE(max(sequence),0)::text AS cursor FROM chat_event WHERE conversation_id=${conversationId}::uuid`,
  );
  let cursor;
  try {
    cursor = readChatCursor(input.before);
  } catch {
    throw createServiceError(400, "invalid_message_cursor");
  }
  const rows = await rawChatRows<
    ChatMessageRecord & { cursorCreatedAt: string }
  >(sql`SELECT ${chatMessageDetailsProjection},to_char(m.created_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorCreatedAt" FROM message m LEFT JOIN "user" u ON u.id=m.sender_id JOIN conversation_member cm ON cm.conversation_id=m.conversation_id AND cm.user_id=${userId}::uuid AND cm.left_at IS NULL
    WHERE m.conversation_id=${conversationId}::uuid AND m.created_at>=cm.joined_at
    ${cursor ? sql`AND (m.created_at,m.id)<(${cursor.createdAt}::timestamp,${cursor.id}::uuid)` : sql``}
    ${input.q ? sql`AND m.deleted_at IS NULL AND position(lower(${input.q}) in lower(m.content))>0` : sql``}
    ORDER BY m.created_at DESC,m.id DESC LIMIT ${input.limit + 1}`);
  const hasMore = rows.length > input.limit;
  const data = rows.slice(0, input.limit).reverse();
  return {
    data,
    eventCursor: watermark?.cursor ?? "0",
    pagination: {
      hasMore,
      nextCursor:
        hasMore && data[0]
          ? writeChatCursor({
              createdAt: data[0].cursorCreatedAt,
              id: data[0].id,
            })
          : null,
    },
  };
}
export async function rawSendChatMessage(
  conversationId: string,
  userId: string,
  externalUserId: string,
  input: z.infer<typeof sendChatMessageSchema>,
) {
  const assetIds = [...new Set(input.assetIds)].sort();
  const fingerprint = createHash("sha256")
    .update(JSON.stringify([input.content, assetIds]))
    .digest("hex");
  await rawCheckConversationAccess(getDatabase(), conversationId, userId);
  const [prior] = await rawChatRows(
    sql`SELECT id,metadata FROM message WHERE conversation_id=${conversationId}::uuid AND sender_id=${userId}::uuid AND client_message_id=${input.clientMessageId}::uuid`,
  );
  if (prior) {
    if (
      (prior.metadata as Record<string, unknown>)?.requestFingerprint !==
      fingerprint
    )
      throw createServiceError(409, "idempotency_conflict");
    return rawGetChatMessage(String(prior.id), userId);
  }
  // Ownership, privacy, ready status and resource binding are verified by Media.
  const assets = await Promise.all(
    assetIds.map((id) =>
      rawInspectChatAsset(id, conversationId, externalUserId),
    ),
  );
  return getDatabase().transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${"chat-send:" + userId},0))`,
    );
    await rawCheckConversationAccess(tx, conversationId, userId, true);
    const [existing] = await rawChatRows(
      sql`SELECT id,metadata FROM message WHERE conversation_id=${conversationId}::uuid AND sender_id=${userId}::uuid AND client_message_id=${input.clientMessageId}::uuid`,
      tx,
    );
    if (existing) {
      if (
        (existing.metadata as Record<string, unknown>)?.requestFingerprint !==
        fingerprint
      )
        throw createServiceError(409, "idempotency_conflict");
      return rawGetChatMessage(String(existing.id), userId, tx);
    }
    const [count] = await rawChatRows(
      sql`SELECT count(*)::int AS n FROM message WHERE sender_id=${userId}::uuid AND created_at>now()-interval '1 minute'`,
      tx,
    );
    if (Number(count?.n) >= 30)
      throw createServiceError(429, "message_rate_limit");
    if (assetIds.length) {
      const bound = await rawChatRows(
        sql`SELECT id FROM message_attachment WHERE media_asset_id IN (${sql.join(
          assetIds.map((id) => sql`${id}::uuid`),
          sql`,`,
        )}) LIMIT 1`,
        tx,
      );
      if (bound.length) throw createServiceError(409, "asset_already_bound");
    }
    const [message] = await rawChatRows<{ id: string }>(
      sql`INSERT INTO message(conversation_id,sender_id,content,type,client_message_id,metadata) VALUES(${conversationId}::uuid,${userId}::uuid,${input.content},${assets.length ? "file" : "text"}::message_type_enum,${input.clientMessageId}::uuid,${JSON.stringify({ requestFingerprint: fingerprint })}::jsonb) RETURNING id`,
      tx,
    );
    if (!message) throw createServiceError(500, "message_create_failed");
    for (const asset of assets)
      await tx.execute(
        sql`INSERT INTO message_attachment(message_id,media_asset_id,file_name,file_url,mime_type,size_bytes) VALUES(${message.id}::uuid,${asset.id}::uuid,${asset.filename},'',${asset.contentType},${String(asset.size)})`,
      );
    await tx.execute(
      sql`UPDATE conversation SET updated_at=now() WHERE id=${conversationId}::uuid`,
    );
    await rawAppendChatEvent(
      tx,
      conversationId,
      userId,
      "message.created",
      message.id,
    );
    return rawGetChatMessage(message.id, userId, tx);
  });
}
export async function rawEditChatMessage(
  id: string,
  userId: string,
  content: string,
  version: number,
) {
  return getDatabase().transaction(async (tx) => {
    const { message } = await rawCheckMessageAccess(id, userId, tx, true);
    if (message.sender_id !== userId)
      throw createServiceError(403, "message_owner_required");
    if (message.deleted_at) throw createServiceError(409, "message_deleted");
    const [updated] = await rawChatRows(
      sql`UPDATE message SET content=${content},version=version+1,edited_at=now(),updated_at=now() WHERE id=${id}::uuid AND version=${version} RETURNING id`,
      tx,
    );
    if (!updated) throw createServiceError(409, "message_version_conflict");
    await rawAppendChatEvent(
      tx,
      String(message.conversation_id),
      userId,
      "message.updated",
      id,
    );
    return rawGetChatMessage(id, userId, tx);
  });
}
export async function rawDeleteChatMessage(id: string, userId: string) {
  return getDatabase().transaction(async (tx) => {
    const { message } = await rawCheckMessageAccess(id, userId, tx, true);
    if (message.sender_id !== userId)
      throw createServiceError(403, "message_owner_required");
    if (!message.deleted_at) {
      await tx.execute(
        sql`UPDATE message SET content='',metadata='{}',deleted_at=now(),updated_at=now(),version=version+1 WHERE id=${id}::uuid`,
      );
      await rawAppendChatEvent(
        tx,
        String(message.conversation_id),
        userId,
        "message.deleted",
        id,
      );
    }
    return rawGetChatMessage(id, userId, tx);
  });
}
export async function rawReactChatMessage(
  id: string,
  userId: string,
  emoji: string,
  remove = false,
) {
  return getDatabase().transaction(async (tx) => {
    const { message } = await rawCheckMessageAccess(id, userId, tx, true);
    if (message.deleted_at) throw createServiceError(409, "message_deleted");
    if (remove)
      await tx.execute(
        sql`DELETE FROM message_reaction WHERE message_id=${id}::uuid AND user_id=${userId}::uuid AND emoji=${emoji}`,
      );
    else
      await tx.execute(
        sql`INSERT INTO message_reaction(message_id,user_id,emoji) VALUES(${id}::uuid,${userId}::uuid,${emoji}) ON CONFLICT DO NOTHING`,
      );
    await rawAppendChatEvent(
      tx,
      String(message.conversation_id),
      userId,
      "reaction.updated",
      id,
    );
    return rawGetChatMessage(id, userId, tx);
  });
}
export async function rawAcknowledgeChatMessage(
  id: string,
  userId: string,
  status: "read" | "delivered",
) {
  return getDatabase().transaction(async (tx) => {
    const { message } = await rawCheckMessageAccess(id, userId, tx);
    // Lock for monotonic cross-device updates, including concurrent member removal.
    await rawCheckConversationAccess(
      tx,
      String(message.conversation_id),
      userId,
      true,
      true,
      false,
    );
    await tx.execute(sql`INSERT INTO message_receipt(message_id,user_id,status,delivered_at,read_at) VALUES(${id}::uuid,${userId}::uuid,${status}::message_delivery_status_enum,now(),CASE WHEN ${status === "read"} THEN now() ELSE NULL END)
      ON CONFLICT(message_id,user_id) DO UPDATE SET status=CASE WHEN message_receipt.status='read' THEN 'read'::message_delivery_status_enum ELSE EXCLUDED.status END,delivered_at=COALESCE(message_receipt.delivered_at,now()),read_at=COALESCE(message_receipt.read_at,EXCLUDED.read_at),updated_at=now()`);
    if (status === "read")
      await tx.execute(
        sql`UPDATE conversation_member cm SET last_read_message_id=${id}::uuid,updated_at=now() WHERE cm.conversation_id=${message.conversation_id}::uuid AND cm.user_id=${userId}::uuid AND (cm.last_read_message_id IS NULL OR (SELECT (m.created_at,m.id)<(${message.created_at}::timestamp,${id}::uuid) FROM message m WHERE m.id=cm.last_read_message_id AND m.conversation_id=cm.conversation_id))`,
      );
    await rawAppendChatEvent(
      tx,
      String(message.conversation_id),
      userId,
      "receipt.updated",
      id,
    );
    return { messageId: id, status };
  });
}
export async function rawReplayChatEvents(
  conversationId: string,
  userId: string,
  after: string,
) {
  const { member } = await rawCheckConversationAccess(
    getDatabase(),
    conversationId,
    userId,
  );
  return rawChatRows(
    sql`SELECT sequence::text,id,type,entity_id AS "entityId",created_at AS "createdAt" FROM chat_event WHERE conversation_id=${conversationId}::uuid AND sequence>${after}::bigint AND created_at>=${member.joined_at} ORDER BY sequence LIMIT 100`,
  );
}

export async function rawSearchChatMessages(
  conversationId: string,
  userId: string,
  query: string,
  limit: number
) {
  const { member } = await rawCheckConversationAccess(
    getDatabase(),
    conversationId,
    userId
  )
  const result = chatSearchResultSchema.parse(
    await rawChatPlatformRequest("discovery", "/discovery/chat/search", "POST", {
      conversationId,
      query,
      joinedAfter: new Date(member.joined_at).toISOString(),
      limit,
    })
  )
  if (!result.data.length) return []
  const allowed = await rawChatRows<{ id: string }>(
    sql`SELECT m.id FROM message m JOIN conversation_member cm ON cm.conversation_id=m.conversation_id AND cm.user_id=${userId}::uuid AND cm.left_at IS NULL WHERE m.conversation_id=${conversationId}::uuid AND m.created_at>=cm.joined_at AND m.deleted_at IS NULL AND m.id IN (${sql.join(
      result.data.map((row) => sql`${row.resourceId}::uuid`),
      sql`,`
    )}) AND position(lower(${query}) in lower(m.content))>0 ORDER BY m.created_at DESC,m.id DESC LIMIT ${limit}`
  )
  return Promise.all(allowed.map((row) => rawGetChatMessage(row.id, userId)))
}
