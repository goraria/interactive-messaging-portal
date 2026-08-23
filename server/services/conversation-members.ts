import { and, eq, inArray, isNull } from "drizzle-orm"
import { database } from "@/database"
import {
  conversationMembersTable,
  usersTable,
  type ConversationRow,
  type UserRow,
} from "@/database/schema"
import type {
  CreateConversationMemberInput,
  UpdateConversationMemberInput,
} from "@/schemas/chat"
import { toConversationMember, toUser } from "@/lib/utils/chat"
import { createServiceError } from "@/lib/utils/service"

export async function listActiveConversationIdsForUser(
  userId: string,
  limit: number
) {
  try {
    const rows = await database
      .select({ conversationId: conversationMembersTable.conversationId })
      .from(conversationMembersTable)
      .where(
        and(
          eq(conversationMembersTable.userId, userId),
          isNull(conversationMembersTable.leftAt)
        )
      )
      .limit(limit)
    return rows.map((row) => row.conversationId)
  } catch (error) {
    throw error
  }
}

export async function assertActiveConversationMember(
  conversationId: string,
  userId: string
) {
  try {
    const [membership] = await database
      .select({ userId: conversationMembersTable.userId })
      .from(conversationMembersTable)
      .where(
        and(
          eq(conversationMembersTable.conversationId, conversationId),
          eq(conversationMembersTable.userId, userId),
          isNull(conversationMembersTable.leftAt)
        )
      )
      .limit(1)

    if (!membership) {
      throw createServiceError(403, "conversation_forbidden")
    }
    return membership
  } catch (error) {
    throw error
  }
}

export async function getConversationMember(
  conversationId: string,
  userId: string
) {
  try {
    const [membership] = await database
      .select()
      .from(conversationMembersTable)
      .where(
        and(
          eq(conversationMembersTable.conversationId, conversationId),
          eq(conversationMembersTable.userId, userId),
          isNull(conversationMembersTable.leftAt)
        )
      )
      .limit(1)
    return membership
  } catch (error) {
    throw error
  }
}

export async function assertConversationManager(
  conversationId: string,
  userId: string
) {
  try {
    const membership = await getConversationMember(conversationId, userId)
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw createServiceError(403, "conversation_manager_required")
    }
    return membership
  } catch (error) {
    throw error
  }
}

export async function listConversationMemberUsers(conversationIds: string[]) {
  try {
    if (conversationIds.length === 0) return []
    return await database
      .select({
        conversationId: conversationMembersTable.conversationId,
        user: usersTable,
      })
      .from(conversationMembersTable)
      .innerJoin(usersTable, eq(conversationMembersTable.userId, usersTable.id))
      .where(
        and(
          inArray(conversationMembersTable.conversationId, conversationIds),
          isNull(conversationMembersTable.leftAt)
        )
      )
  } catch (error) {
    throw error
  }
}

export async function listConversationMembers(conversationId: string) {
  try {
    const rows = await database
      .select({ member: conversationMembersTable, user: usersTable })
      .from(conversationMembersTable)
      .innerJoin(usersTable, eq(conversationMembersTable.userId, usersTable.id))
      .where(eq(conversationMembersTable.conversationId, conversationId))

    return rows.map((row) => ({
      ...toConversationMember(row.member),
      user: toUser(row.user),
    }))
  } catch (error) {
    throw error
  }
}

export async function addConversationMember(
  conversationId: string,
  input: CreateConversationMemberInput
) {
  try {
    const [member] = await database
      .insert(conversationMembersTable)
      .values({
        conversationId,
        userId: input.userId,
        role: input.role,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          conversationMembersTable.conversationId,
          conversationMembersTable.userId,
        ],
        set: { role: input.role, leftAt: null, updatedAt: new Date() },
      })
      .returning()

    if (!member) throw createServiceError(500, "member_create_failed")
    return toConversationMember(member)
  } catch (error) {
    throw error
  }
}

export async function updateConversationMember(
  conversationId: string,
  userId: string,
  input: UpdateConversationMemberInput
) {
  try {
    const [member] = await database
      .update(conversationMembersTable)
      .set({
        role: input.role,
        lastReadMessageId: input.lastReadMessageId,
        mutedUntil: input.mutedUntil,
        leftAt: input.leftAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversationMembersTable.conversationId, conversationId),
          eq(conversationMembersTable.userId, userId)
        )
      )
      .returning()

    if (!member) throw createServiceError(404, "member_not_found")
    return toConversationMember(member)
  } catch (error) {
    throw error
  }
}

export async function removeConversationMember(
  conversationId: string,
  userId: string
) {
  try {
    const [member] = await database
      .delete(conversationMembersTable)
      .where(
        and(
          eq(conversationMembersTable.conversationId, conversationId),
          eq(conversationMembersTable.userId, userId)
        )
      )
      .returning()

    if (!member) throw createServiceError(404, "member_not_found")
    return toConversationMember(member)
  } catch (error) {
    throw error
  }
}

export async function ensureConversationMember(
  conversation: ConversationRow,
  user: UserRow
) {
  try {
    await database
      .insert(conversationMembersTable)
      .values({
        conversationId: conversation.id,
        userId: user.id,
        role: conversation.createdById === user.id ? "owner" : "member",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
  } catch (error) {
    throw error
  }
}
