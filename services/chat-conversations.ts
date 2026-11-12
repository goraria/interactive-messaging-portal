import "server-only"
import { randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import { getDatabase } from "@/database"
import {
  appendChatEvent,
  chatRows,
  checkConversationAccess,
  requireChatManager,
} from "@/services/helper"
import { canManageMember } from "@/utils/chat-policy"
import { formatChatConversation } from "@/utils/formatter"
import { createServiceError } from "@/utils/service"
import {
  chatMessageProjection,
  type ChatMembership,
  type startConversationSchema,
} from "@/schemas/chat-domain"
import type { z } from "@gorth-io/structure/cores/zod"

export async function listChatConversations(
  userId: string,
  limit: number,
  onlyId?: string
) {
  const rows = await chatRows<{
    id: string
    unreadCount: number
  }>(sql`SELECT c.id,c.slug,c.type,c.title,c.created_by_id AS "createdById",c.metadata,c.archived_at AS "archivedAt",c.created_at AS "createdAt",c.updated_at AS "updatedAt",
    cm.role, cm.muted_until AS "mutedUntil",
    COALESCE((SELECT json_agg(json_build_object('id',u.id,'externalUserId',u.external_user_id,'name',u.name,'email',u.email,'image',u.image,'status',u.status,'metadata',u.metadata,'lastSeenAt',to_char(timezone('UTC',u.last_seen_at),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'syncedAt',to_char(timezone('UTC',u.synced_at),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'createdAt',to_char(timezone('UTC',u.created_at),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'updatedAt',to_char(timezone('UTC',u.updated_at),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) FROM conversation_member m JOIN "user" u ON u.id=m.user_id WHERE m.conversation_id=c.id AND m.left_at IS NULL),'[]'::json) AS members,
    (SELECT row_to_json(x) FROM (SELECT ${chatMessageProjection} FROM message m LEFT JOIN "user" u ON u.id=m.sender_id WHERE m.conversation_id=c.id AND m.created_at>=cm.joined_at ORDER BY m.created_at DESC,m.id DESC LIMIT 1)x) AS "lastMessage",
    (SELECT count(*)::int FROM message m WHERE m.conversation_id=c.id AND m.sender_id<>${userId}::uuid AND m.deleted_at IS NULL AND m.created_at >= cm.joined_at AND (cm.last_read_message_id IS NULL OR (m.created_at,m.id) > (SELECT r.created_at,r.id FROM message r WHERE r.id=cm.last_read_message_id AND r.conversation_id=c.id))) AS "unreadCount"
    FROM conversation c JOIN conversation_member cm ON cm.conversation_id=c.id AND cm.user_id=${userId}::uuid AND cm.left_at IS NULL
    ${onlyId ? sql`WHERE c.id=${onlyId}::uuid` : sql``}
    ORDER BY c.updated_at DESC,c.id DESC LIMIT ${limit}`)
  return rows.map(formatChatConversation)
}
export async function getChatConversation(id: string, userId: string) {
  await checkConversationAccess(getDatabase(), id, userId)
  // Apply membership filtering in the query as well as at the boundary.
  const rows = await listChatConversations(userId, 1, id)
  const result = rows.find((row) => row.id === id)
  if (!result) throw createServiceError(404, "conversation_not_found")
  return result
}
export async function startChatConversation(
  userId: string,
  input: z.infer<typeof startConversationSchema>
) {
  const participants = [...new Set([userId, ...input.participantIds])].sort()
  if (input.type === "direct" && participants.length !== 2)
    throw createServiceError(400, "direct_requires_two_members")
  return getDatabase().transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${"chat-conversation:" + userId},0))`
    )
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${participants.join(":")},0))`
    )
    const users = await chatRows(
      sql`SELECT id FROM "user" WHERE id IN (${sql.join(
        participants.map((id) => sql`${id}::uuid`),
        sql`,`
      )}) AND status='active'`,
      tx
    )
    if (users.length !== participants.length)
      throw createServiceError(400, "invalid_participant")
    const [blocked] = await chatRows(
      sql`SELECT 1 FROM chat_block WHERE (user_id=${userId}::uuid AND target_id IN (${sql.join(
        participants.map((id) => sql`${id}::uuid`),
        sql`,`
      )})) OR (target_id=${userId}::uuid AND user_id IN (${sql.join(
        participants.map((id) => sql`${id}::uuid`),
        sql`,`
      )})) LIMIT 1`,
      tx
    )
    if (blocked) throw createServiceError(403, "communication_blocked")
    if (input.type === "direct") {
      const [existing] = await chatRows(
        sql`SELECT c.id,c.slug,c.type,c.title,c.created_by_id AS "createdById",c.metadata,c.archived_at AS "archivedAt",c.created_at AS "createdAt",c.updated_at AS "updatedAt" FROM conversation c JOIN conversation_member cm ON cm.conversation_id=c.id WHERE c.type='direct' AND cm.left_at IS NULL GROUP BY c.id HAVING count(*)=2 AND bool_and(cm.user_id IN (${sql.join(
          participants.map((id) => sql`${id}::uuid`),
          sql`,`
        )})) LIMIT 1`,
        tx
      )
      if (existing) return formatChatConversation(existing)
    }
    const [count] = await chatRows(
      sql`SELECT count(*)::int AS value FROM conversation WHERE created_by_id=${userId}::uuid AND created_at>now()-interval '1 minute'`,
      tx
    )
    if (Number(count?.value) >= 5)
      throw createServiceError(429, "conversation_rate_limit")
    const id = randomUUID()
    const [conversation] = await chatRows(
      sql`INSERT INTO conversation(id,slug,type,title,created_by_id) VALUES(${id}::uuid,${"conversation-" + id},${input.type}::conversation_type_enum,${input.title ?? null},${userId}::uuid) RETURNING id,slug,type,title,created_by_id AS "createdById",metadata,archived_at AS "archivedAt",created_at AS "createdAt",updated_at AS "updatedAt"`,
      tx
    )
    for (const participant of participants)
      await tx.execute(
        sql`INSERT INTO conversation_member(conversation_id,user_id,role) VALUES(${id}::uuid,${participant}::uuid,${participant === userId ? "owner" : "member"}::conversation_member_role_enum)`
      )
    await appendChatEvent(tx, id, userId, "conversation.created", id)
    if (!conversation)
      throw createServiceError(500, "conversation_create_failed")
    return formatChatConversation(conversation)
  })
}
export async function changeChatConversation(
  id: string,
  userId: string,
  input: { title?: string; archived?: boolean; remove?: boolean }
) {
  return getDatabase().transaction(async (tx) => {
    const { member } = await checkConversationAccess(
      tx,
      id,
      userId,
      true,
      true,
      false
    )
    requireChatManager(member)
    if (input.remove && member.role !== "owner")
      throw createServiceError(403, "owner_required")
    // Archive, rather than cascading away messages/reports. Content deletion is explicit.
    const [result] = await chatRows(
      sql`UPDATE conversation SET title=COALESCE(${input.title ?? null},title),archived_at=CASE WHEN ${input.remove || input.archived === true} THEN now() WHEN ${input.archived === false} THEN NULL ELSE archived_at END,updated_at=now() WHERE id=${id}::uuid RETURNING id`,
      tx
    )
    if (input.remove || input.archived)
      await tx.execute(
        sql`UPDATE chat_call SET state='ended',ended_at=now() WHERE conversation_id=${id}::uuid AND state IN ('ringing','active')`
      )
    await appendChatEvent(tx, id, userId, "conversation.updated", id)
    return result
  })
}
export async function listChatMembers(id: string, userId: string) {
  await checkConversationAccess(getDatabase(), id, userId)
  return chatRows(
    sql`SELECT cm.user_id AS "userId",cm.role,cm.left_at AS "leftAt",cm.joined_at AS "joinedAt",u.name FROM conversation_member cm JOIN "user" u ON u.id=cm.user_id WHERE cm.conversation_id=${id}::uuid ORDER BY cm.joined_at,cm.user_id`
  )
}
export async function archiveChatConversation(id: string, userId: string) {
  return changeChatConversation(id, userId, { remove: true })
}
export async function changeChatMember(
  id: string,
  actor: string,
  target: string,
  operation: "add" | "role" | "remove",
  role: "owner" | "admin" | "member" = "member"
) {
  return getDatabase().transaction(async (tx) => {
    const { member, conversation } = await checkConversationAccess(
      tx,
      id,
      actor,
      true,
      true,
      false
    )
    if (conversation.type === "direct")
      throw createServiceError(409, "direct_members_are_fixed")
    const [existing] = await chatRows<ChatMembership>(
      sql`SELECT * FROM conversation_member WHERE conversation_id=${id}::uuid AND user_id=${target}::uuid AND left_at IS NULL`,
      tx
    )
    const selfLeave = operation === "remove" && actor === target
    if (
      !selfLeave &&
      !canManageMember(
        member.role,
        existing?.role ?? "member",
        operation === "remove" ? undefined : role
      )
    )
      throw createServiceError(403, "member_change_forbidden")
    if (existing?.role === "owner") {
      if (operation !== "role" || role !== "owner")
        throw createServiceError(409, "transfer_ownership_first")
    }
    if (operation === "add") {
      if (role === "owner")
        throw createServiceError(409, "use_ownership_transfer")
      const [user] = await chatRows(
        sql`SELECT id FROM "user" WHERE id=${target}::uuid AND status='active'`,
        tx
      )
      if (!user) throw createServiceError(404, "user_not_found")
      const [blocked] = await chatRows(
        sql`SELECT 1 FROM chat_block WHERE (user_id=${target}::uuid AND target_id=${actor}::uuid) OR (user_id=${actor}::uuid AND target_id=${target}::uuid)`,
        tx
      )
      if (blocked) throw createServiceError(403, "communication_blocked")
      const [count] = await chatRows(
        sql`SELECT count(*)::int AS n FROM conversation_member WHERE conversation_id=${id}::uuid AND left_at IS NULL`,
        tx
      )
      if (!existing && Number(count?.n) >= 100)
        throw createServiceError(409, "member_limit")
      await tx.execute(
        sql`INSERT INTO conversation_member(conversation_id,user_id,role) VALUES(${id}::uuid,${target}::uuid,${role}::conversation_member_role_enum) ON CONFLICT(conversation_id,user_id) DO UPDATE SET role=EXCLUDED.role,joined_at=CASE WHEN conversation_member.left_at IS NULL THEN conversation_member.joined_at ELSE now() END,left_at=NULL,last_read_message_id=NULL,updated_at=now()`
      )
    } else {
      if (!existing) throw createServiceError(404, "member_not_found")
      if (role === "owner" && operation === "role") {
        if (member.role !== "owner" || target === actor)
          throw createServiceError(403, "ownership_transfer_forbidden")
        await tx.execute(
          sql`UPDATE conversation_member SET role='admin' WHERE conversation_id=${id}::uuid AND user_id=${actor}::uuid`
        )
      }
      await tx.execute(
        sql`UPDATE conversation_member SET role=CASE WHEN ${operation === "role"} THEN ${role}::conversation_member_role_enum ELSE role END,left_at=CASE WHEN ${operation === "remove"} THEN now() ELSE left_at END,updated_at=now() WHERE conversation_id=${id}::uuid AND user_id=${target}::uuid`
      )
    }
    await tx.execute(
      sql`UPDATE chat_call SET state='ended',ended_at=now() WHERE conversation_id=${id}::uuid AND state IN ('ringing','active')`
    )
    await appendChatEvent(tx, id, actor, "member.updated", target)
    return {
      conversationId: id,
      userId: target,
      role,
      leftAt: operation === "remove" ? new Date() : null,
    }
  })
}
export async function setChatMute(
  id: string,
  userId: string,
  until: Date | null
) {
  return getDatabase().transaction(async (tx) => {
    await checkConversationAccess(tx, id, userId, true, true, false)
    await tx.execute(
      sql`UPDATE conversation_member SET muted_until=${until?.toISOString() ?? null}::timestamptz,updated_at=now() WHERE conversation_id=${id}::uuid AND user_id=${userId}::uuid`
    )
    return { mutedUntil: until }
  })
}
export async function setChatBlock(
  actor: string,
  target: string,
  blocked: boolean
) {
  if (actor === target) throw createServiceError(400, "cannot_block_self")
  return getDatabase().transaction(async (tx) => {
    await tx.execute(
      sql`SELECT c.id FROM conversation c WHERE EXISTS(SELECT 1 FROM conversation_member m WHERE m.conversation_id=c.id AND m.user_id=${actor}::uuid AND m.left_at IS NULL) AND EXISTS(SELECT 1 FROM conversation_member m WHERE m.conversation_id=c.id AND m.user_id=${target}::uuid AND m.left_at IS NULL) ORDER BY c.id FOR UPDATE`
    )
    if (blocked)
      await tx.execute(
        sql`INSERT INTO chat_block(user_id,target_id) VALUES(${actor}::uuid,${target}::uuid) ON CONFLICT DO NOTHING`
      )
    else
      await tx.execute(
        sql`DELETE FROM chat_block WHERE user_id=${actor}::uuid AND target_id=${target}::uuid`
      )
    if (blocked)
      await tx.execute(
        sql`UPDATE chat_call SET state='ended',ended_at=now() WHERE state IN ('ringing','active') AND ((caller_id=${actor}::uuid AND callee_id=${target}::uuid) OR (caller_id=${target}::uuid AND callee_id=${actor}::uuid))`
      )
    return { blocked, targetId: target }
  })
}
