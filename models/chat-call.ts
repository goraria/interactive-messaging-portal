import "server-only";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/database";
import { rawChatRows, rawCheckConversationAccess, rawAppendChatEvent } from "@/models/index"
import { createServiceError } from "@/utils/service";
import { chatIceServersJson } from "@/utils/environment";
import type { callSignalSchema } from "@/schemas/chat-domain";
import type { z } from "@gorth-com/structure/cores/zod";

export async function rawListChatCalls(
  conversationId: string,
  userId: string,
) {
  await rawCheckConversationAccess(getDatabase(), conversationId, userId);
  return rawChatRows(
    sql`SELECT id,conversation_id AS "conversationId",caller_id AS "callerId",callee_id AS "calleeId",kind,state,expires_at AS "expiresAt",created_at AS "createdAt",ended_at AS "endedAt" FROM chat_call WHERE conversation_id=${conversationId}::uuid AND (caller_id=${userId}::uuid OR callee_id=${userId}::uuid) ORDER BY created_at DESC,id DESC LIMIT 30`,
  );
}
export async function rawIncomingChatCalls(
  userId: string,
  conversationId?: string,
) {
  return rawChatRows(
    sql`SELECT c.id,c.conversation_id AS "conversationId",c.caller_id AS "callerId",c.callee_id AS "calleeId",c.kind,c.state,c.expires_at AS "expiresAt",c.created_at AS "createdAt",c.ended_at AS "endedAt" FROM chat_call c JOIN conversation_member m ON m.conversation_id=c.conversation_id AND m.user_id=${userId}::uuid AND m.left_at IS NULL WHERE c.callee_id=${userId}::uuid AND ${conversationId ? sql`c.conversation_id=${conversationId}::uuid` : sql`true`} AND c.state='ringing' AND c.expires_at>now() AND NOT EXISTS(SELECT 1 FROM chat_block b WHERE (b.user_id=c.caller_id AND b.target_id=c.callee_id) OR (b.target_id=c.caller_id AND b.user_id=c.callee_id)) ORDER BY c.created_at DESC LIMIT 10`,
  );
}
export async function rawStartChatCall(
  conversationId: string,
  userId: string,
  kind: "audio" | "video",
  clientId: string,
) {
  return getDatabase().transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${"chat-call:" + userId},0))`,
    );
    const { conversation } = await rawCheckConversationAccess(
      tx,
      conversationId,
      userId,
      true,
    );
    if (conversation.type !== "direct")
      throw createServiceError(409, "direct_calls_only");
    const [existing] = await rawChatRows(
      sql`SELECT * FROM chat_call WHERE caller_id=${userId}::uuid AND client_id=${clientId}::uuid`,
      tx,
    );
    if (existing) {
      if (existing.conversation_id !== conversationId || existing.kind !== kind)
        throw createServiceError(409, "idempotency_conflict");
      return { id: existing.id };
    }
    const peers = await rawChatRows(
      sql`SELECT user_id FROM conversation_member WHERE conversation_id=${conversationId}::uuid AND left_at IS NULL AND user_id<>${userId}::uuid`,
      tx,
    );
    if (peers.length !== 1)
      throw createServiceError(409, "call_peer_unavailable");
    await tx.execute(
      sql`UPDATE chat_call SET state=CASE WHEN state='ringing' THEN 'missed' ELSE 'ended' END,ended_at=now() WHERE conversation_id=${conversationId}::uuid AND state IN ('ringing','active') AND expires_at<now()`,
    );
    const [live] = await rawChatRows(
      sql`SELECT id FROM chat_call WHERE conversation_id=${conversationId}::uuid AND state IN ('ringing','active')`,
      tx,
    );
    if (live) throw createServiceError(409, "call_in_progress");
    const [recent] = await rawChatRows(
      sql`SELECT count(*)::int AS n FROM chat_call WHERE caller_id=${userId}::uuid AND created_at>now()-interval '1 minute'`,
      tx,
    );
    if (Number(recent?.n) >= 5)
      throw createServiceError(429, "call_rate_limit");
    const [call] = await rawChatRows<{ id: string }>(
      sql`INSERT INTO chat_call(conversation_id,caller_id,callee_id,client_id,kind) VALUES(${conversationId}::uuid,${userId}::uuid,${peers[0]!.user_id}::uuid,${clientId}::uuid,${kind}) RETURNING id`,
      tx,
    );
    if (!call) throw createServiceError(500, "call_create_failed");
    await rawAppendChatEvent(
      tx,
      conversationId,
      userId,
      "call.created",
      call.id,
    );
    return call;
  });
}
export async function rawSignalChatCall(
  callId: string,
  userId: string,
  input: z.infer<typeof callSignalSchema>,
) {
  return getDatabase().transaction(async (tx) => {
    const [call] = await rawChatRows(
      sql`SELECT * FROM chat_call WHERE id=${callId}::uuid`,
      tx,
    );
    if (!call || ![call.caller_id, call.callee_id].includes(userId))
      throw createServiceError(404, "call_not_found");
    await rawCheckConversationAccess(
      tx,
      String(call.conversation_id),
      userId,
      true,
    );
    const [current] = await rawChatRows(
      sql`SELECT * FROM chat_call WHERE id=${callId}::uuid FOR UPDATE`,
      tx,
    );
    if (!current) throw createServiceError(404, "call_not_found");
    const [prior] = await rawChatRows(
      sql`SELECT kind,payload FROM chat_signal WHERE call_id=${callId}::uuid AND sender_id=${userId}::uuid AND client_id=${input.clientId}::uuid`,
      tx,
    );
    if (prior) {
      if (prior.kind !== input.kind || prior.payload !== input.payload)
        throw createServiceError(409, "idempotency_conflict");
      return { id: callId };
    }
    if (
      !["ringing", "active"].includes(String(current.state)) ||
      new Date(String(current.expires_at)) <= new Date()
    )
      throw createServiceError(409, "call_ended");
    if (
      ["accept", "reject", "answer"].includes(input.kind) &&
      userId !== current.callee_id
    )
      throw createServiceError(403, "callee_required");
    if (input.kind === "offer" && userId !== current.caller_id)
      throw createServiceError(403, "caller_required");
    if (input.kind === "answer" && current.state !== "active")
      throw createServiceError(409, "call_not_accepted");
    const [count] = await rawChatRows(
      sql`SELECT count(*)::int AS n FROM chat_signal WHERE call_id=${callId}::uuid`,
      tx,
    );
    if (Number(count?.n) >= 1000) throw createServiceError(429, "signal_limit");
    await tx.execute(
      sql`INSERT INTO chat_signal(call_id,sender_id,client_id,kind,payload) VALUES(${callId}::uuid,${userId}::uuid,${input.clientId}::uuid,${input.kind},${input.payload})`,
    );
    if (input.kind === "accept")
      await tx.execute(
        sql`UPDATE chat_call SET state='active',expires_at=now()+interval '2 hours' WHERE id=${callId}::uuid AND state='ringing'`,
      );
    if (["reject", "end"].includes(input.kind))
      await tx.execute(
        sql`UPDATE chat_call SET state=${input.kind === "reject" ? "rejected" : "ended"},ended_at=now() WHERE id=${callId}::uuid`,
      );
    await rawAppendChatEvent(
      tx,
      String(call.conversation_id),
      userId,
      "call.updated",
      callId,
    );
    return { id: callId };
  });
}
export async function rawListChatSignals(
  callId: string,
  userId: string,
  after: string,
) {
  const [call] = await rawChatRows(
    sql`SELECT * FROM chat_call WHERE id=${callId}::uuid AND (caller_id=${userId}::uuid OR callee_id=${userId}::uuid)`,
  );
  if (!call) throw createServiceError(404, "call_not_found");
  await rawCheckConversationAccess(
    getDatabase(),
    String(call.conversation_id),
    userId,
    true,
  );
  if (
    new Date(String(call.expires_at)) < new Date() ||
    !["ringing", "active"].includes(String(call.state))
  )
    return { data: [], state: "ended" };
  const data = await rawChatRows(
    sql`SELECT sequence::text,kind,payload,sender_id AS "senderId" FROM chat_signal WHERE call_id=${callId}::uuid AND sender_id<>${userId}::uuid AND sequence>${after}::bigint ORDER BY sequence LIMIT 100`,
  );
  return { data, state: call.state };
}
export function rawChatIceConfiguration() {
  try {
    const values: unknown = JSON.parse(chatIceServersJson);
    if (!Array.isArray(values) || values.length > 10) throw new Error();
    for (const entry of values) {
      if (!entry || typeof entry !== "object") throw new Error();
      const urls = Array.isArray(entry.urls) ? entry.urls : [entry.urls];
      if (
        !urls.length ||
        urls.some(
          (url: unknown) =>
            typeof url !== "string" || !/^turns?:|^stuns?:/.test(url),
        )
      )
        throw new Error();
    }
    return { iceServers: values };
  } catch {
    throw createServiceError(503, "invalid_ice_configuration");
  }
}
