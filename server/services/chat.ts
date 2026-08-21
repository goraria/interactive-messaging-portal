import { randomUUID } from "node:crypto"
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm"
import { database } from "@/database"
import {
  conversationMembersTable,
  conversationsTable,
  messageAttachmentsTable,
  messageReactionsTable,
  messageReceiptsTable,
  messagesTable,
  usersTable,
  type ConversationRow,
  type ConversationMemberRow,
  type MessageAttachmentRow,
  type MessageReactionRow,
  type MessageReceiptRow,
  type MessageRow,
  type UserRow,
} from "@/database/schema"
import type {
  CreateConversationInput,
  CreateConversationMemberInput,
  CreateMessageAttachmentInput,
  CreateMessageReactionInput,
  CreateMessageReceiptInput,
  CreateRoomMessageInput,
  CreateUserInput,
  UpdateConversationInput,
  UpdateConversationMemberInput,
  UpdateMessageAttachmentInput,
  UpdateMessageInput,
  UpdateMessageReceiptInput,
  UpdateUserInput,
} from "@/schemas/chat"

export interface AuthUserInput {
  id: string
  name: string
  email?: string
  image?: string | null
}

export interface ServiceError extends Error {
  statusCode: number
  code: string
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function createServiceError(statusCode: number, code: string) {
  const error = new Error(code) as ServiceError
  error.statusCode = statusCode
  error.code = code

  return error
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)

  return slug || `conversation-${randomUUID()}`
}

function fallbackEmail(externalUserId: string) {
  return `${encodeURIComponent(externalUserId)}@local.gorth.chat`
}

function toUser(row: UserRow) {
  return {
    id: row.id,
    externalUserId: row.externalUserId,
    name: row.name,
    email: row.email,
    image: row.image,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toConversation(row: ConversationRow) {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    title: row.title,
    createdById: row.createdById,
    metadata: row.metadata,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toConversationMember(row: ConversationMemberRow) {
  return {
    conversationId: row.conversationId,
    userId: row.userId,
    role: row.role,
    lastReadMessageId: row.lastReadMessageId,
    mutedUntil: row.mutedUntil?.toISOString() ?? null,
    joinedAt: row.joinedAt.toISOString(),
    leftAt: row.leftAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toMessage(
  row: MessageRow,
  sender: UserRow | null | undefined,
  conversation?: ConversationRow | null
) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    content: row.content,
    type: row.type,
    metadata: row.metadata,
    user: {
      id: sender?.externalUserId ?? sender?.id ?? row.senderId ?? "",
      name: sender?.name ?? "Unknown user",
      email: sender?.email ?? null,
    },
    roomName: conversation?.slug ?? undefined,
    editedAt: row.editedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toAttachment(row: MessageAttachmentRow) {
  return {
    id: row.id,
    messageId: row.messageId,
    fileName: row.fileName,
    fileUrl: row.fileUrl,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  }
}

function toReaction(row: MessageReactionRow) {
  return {
    id: row.id,
    messageId: row.messageId,
    userId: row.userId,
    emoji: row.emoji,
    createdAt: row.createdAt.toISOString(),
  }
}

function toReceipt(row: MessageReceiptRow) {
  return {
    id: row.id,
    messageId: row.messageId,
    userId: row.userId,
    status: row.status,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function findConversation(identifier: string) {
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
}

async function ensureUser(user: AuthUserInput) {
  const email = user.email ?? fallbackEmail(user.id)
  const [existing] = await database
    .select()
    .from(usersTable)
    .where(
      user.email
        ? or(
            eq(usersTable.externalUserId, user.id),
            eq(usersTable.email, email)
          )
        : eq(usersTable.externalUserId, user.id)
    )
    .limit(1)

  if (existing) {
    const [updated] = await database
      .update(usersTable)
      .set({
        externalUserId: existing.externalUserId ?? user.id,
        name: user.name,
        email,
        image: user.image === undefined ? existing.image : user.image,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, existing.id))
      .returning()

    return updated ?? existing
  }

  const [created] = await database
    .insert(usersTable)
    .values({
      externalUserId: user.id,
      name: user.name,
      email,
      image: user.image ?? null,
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  if (!created) {
    throw createServiceError(500, "user_create_failed")
  }

  return created
}

async function getCurrentUserRow(user: AuthUserInput) {
  const [existing] = await database
    .select()
    .from(usersTable)
    .where(eq(usersTable.externalUserId, user.id))
    .limit(1)

  return existing ?? ensureUser(user)
}

export async function syncUser(user: AuthUserInput) {
  return toUser(await ensureUser(user))
}

export async function getCurrentUser(user: AuthUserInput) {
  return toUser(await getCurrentUserRow(user))
}

async function loadConversationDetails(conversations: ConversationRow[]) {
  const conversationIds = conversations.map((conversation) => conversation.id)

  if (conversationIds.length === 0) {
    return []
  }

  const memberRows = await database
    .select({
      conversationId: conversationMembersTable.conversationId,
      user: usersTable,
    })
    .from(conversationMembersTable)
    .innerJoin(usersTable, eq(conversationMembersTable.userId, usersTable.id))
    .where(
      and(
        inArray(conversationMembersTable.conversationId, conversationIds),
        isNull(conversationMembersTable.leftAt),
      ),
    )

  const messageRows = await database
    .selectDistinctOn([messagesTable.conversationId], {
      message: messagesTable,
      sender: usersTable,
    })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(
      and(
        inArray(messagesTable.conversationId, conversationIds),
        isNull(messagesTable.deletedAt),
      ),
    )
    .orderBy(messagesTable.conversationId, desc(messagesTable.createdAt))

  const membersByConversation = new Map<string, UserRow[]>()
  const lastMessageByConversation = new Map<
    string,
    (typeof messageRows)[number]
  >()

  for (const row of memberRows) {
    const members = membersByConversation.get(row.conversationId) ?? []
    members.push(row.user)
    membersByConversation.set(row.conversationId, members)
  }

  for (const row of messageRows) {
    lastMessageByConversation.set(row.message.conversationId, row)
  }

  return conversations.map((conversation) => {
    const lastMessage = lastMessageByConversation.get(conversation.id)

    return {
      ...toConversation(conversation),
      members: (membersByConversation.get(conversation.id) ?? []).map(toUser),
      lastMessage: lastMessage
        ? toMessage(lastMessage.message, lastMessage.sender, conversation)
        : null,
    }
  })
}

async function getAuthorizedConversation(
  identifier: string,
  authUser: AuthUserInput,
) {
  const user = await getCurrentUserRow(authUser)
  const conversation = await findConversation(identifier)

  if (!conversation) {
    throw createServiceError(404, "conversation_not_found")
  }

  const [membership] = await database
    .select({ userId: conversationMembersTable.userId })
    .from(conversationMembersTable)
    .where(
      and(
        eq(conversationMembersTable.conversationId, conversation.id),
        eq(conversationMembersTable.userId, user.id),
        isNull(conversationMembersTable.leftAt),
      ),
    )
    .limit(1)

  if (!membership) {
    throw createServiceError(403, "conversation_forbidden")
  }

  return { conversation, user }
}

async function ensureConversation(slug: string, creator?: UserRow) {
  const existing = await findConversation(slug)

  if (existing) {
    return existing
  }

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
}

async function ensureConversationMember(
  conversation: ConversationRow,
  user: UserRow
) {
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
}

export async function listUsers(limit: number) {
  const rows = await database
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)

  return rows.map(toUser)
}

export async function createUser(input: CreateUserInput) {
  const [user] = await database
    .insert(usersTable)
    .values({
      externalUserId: input.externalUserId,
      name: input.name,
      email: input.email,
      image: input.image,
      metadata: input.metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  if (!user) {
    throw createServiceError(500, "user_create_failed")
  }

  return toUser(user)
}

export async function getUser(userId: string) {
  const [user] = await database
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1)

  if (!user) {
    throw createServiceError(404, "user_not_found")
  }

  return toUser(user)
}

export async function updateUser(userId: string, input: UpdateUserInput) {
  const [user] = await database
    .update(usersTable)
    .set({
      externalUserId: input.externalUserId,
      name: input.name,
      email: input.email,
      image: input.image,
      metadata: input.metadata,
      lastSeenAt: input.lastSeenAt ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId))
    .returning()

  if (!user) {
    throw createServiceError(404, "user_not_found")
  }

  return toUser(user)
}

export async function deleteUser(userId: string) {
  const [user] = await database
    .delete(usersTable)
    .where(eq(usersTable.id, userId))
    .returning()

  if (!user) {
    throw createServiceError(404, "user_not_found")
  }

  return toUser(user)
}

export async function listConversations(authUser: AuthUserInput, limit: number) {
  const user = await getCurrentUserRow(authUser)
  const rows = await database
    .select({ conversation: conversationsTable })
    .from(conversationMembersTable)
    .innerJoin(
      conversationsTable,
      eq(conversationMembersTable.conversationId, conversationsTable.id),
    )
    .where(
      and(
        eq(conversationMembersTable.userId, user.id),
        isNull(conversationMembersTable.leftAt),
      ),
    )
    .orderBy(desc(conversationsTable.updatedAt))
    .limit(limit)

  return loadConversationDetails(rows.map((row) => row.conversation))
}

export async function createConversation(input: CreateConversationInput) {
  const [conversation] = await database
    .insert(conversationsTable)
    .values({
      slug: slugify(input.slug || input.title || ""),
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
}

export async function getConversation(
  authUser: AuthUserInput,
  conversationId: string,
) {
  const { conversation } = await getAuthorizedConversation(
    conversationId,
    authUser,
  )
  const [details] = await loadConversationDetails([conversation])

  if (!details) {
    throw createServiceError(404, "conversation_not_found")
  }

  return details
}

export async function updateConversation(
  conversationId: string,
  input: UpdateConversationInput
) {
  const conversation = await findConversation(conversationId)

  if (!conversation) {
    throw createServiceError(404, "conversation_not_found")
  }

  const [updated] = await database
    .update(conversationsTable)
    .set({
      slug: input.slug ? slugify(input.slug) : undefined,
      title: input.title,
      type: input.type,
      metadata: input.metadata,
      archivedAt: input.archivedAt ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(conversationsTable.id, conversation.id))
    .returning()

  if (!updated) {
    throw createServiceError(404, "conversation_not_found")
  }

  return toConversation(updated)
}

export async function deleteConversation(conversationId: string) {
  const conversation = await findConversation(conversationId)

  if (!conversation) {
    throw createServiceError(404, "conversation_not_found")
  }

  const [deleted] = await database
    .delete(conversationsTable)
    .where(eq(conversationsTable.id, conversation.id))
    .returning()

  if (!deleted) {
    throw createServiceError(404, "conversation_not_found")
  }

  return toConversation(deleted)
}

export async function listConversationMembers(conversationId: string) {
  const conversation = await findConversation(conversationId)

  if (!conversation) {
    throw createServiceError(404, "conversation_not_found")
  }

  const rows = await database
    .select({
      member: conversationMembersTable,
      user: usersTable,
    })
    .from(conversationMembersTable)
    .innerJoin(usersTable, eq(conversationMembersTable.userId, usersTable.id))
    .where(eq(conversationMembersTable.conversationId, conversation.id))

  return rows.map((row) => ({
    ...toConversationMember(row.member),
    user: toUser(row.user),
  }))
}

export async function addConversationMember(
  conversationId: string,
  input: CreateConversationMemberInput
) {
  const conversation = await findConversation(conversationId)

  if (!conversation) {
    throw createServiceError(404, "conversation_not_found")
  }

  const [member] = await database
    .insert(conversationMembersTable)
    .values({
      conversationId: conversation.id,
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
      set: {
        role: input.role,
        leftAt: null,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!member) {
    throw createServiceError(500, "member_create_failed")
  }

  return toConversationMember(member)
}

export async function updateConversationMember(
  conversationId: string,
  userId: string,
  input: UpdateConversationMemberInput
) {
  const conversation = await findConversation(conversationId)

  if (!conversation) {
    throw createServiceError(404, "conversation_not_found")
  }

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
        eq(conversationMembersTable.conversationId, conversation.id),
        eq(conversationMembersTable.userId, userId)
      )
    )
    .returning()

  if (!member) {
    throw createServiceError(404, "member_not_found")
  }

  return toConversationMember(member)
}

export async function removeConversationMember(
  conversationId: string,
  userId: string
) {
  const conversation = await findConversation(conversationId)

  if (!conversation) {
    throw createServiceError(404, "conversation_not_found")
  }

  const [member] = await database
    .delete(conversationMembersTable)
    .where(
      and(
        eq(conversationMembersTable.conversationId, conversation.id),
        eq(conversationMembersTable.userId, userId)
      )
    )
    .returning()

  if (!member) {
    throw createServiceError(404, "member_not_found")
  }

  return toConversationMember(member)
}

async function loadConversationMessages(
  conversation: ConversationRow,
  limit: number,
) {
  const rows = await database
    .select({
      message: messagesTable,
      sender: usersTable,
    })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(eq(messagesTable.conversationId, conversation.id))
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit)

  return rows
    .toReversed()
    .map((row) => toMessage(row.message, row.sender, conversation))
}

export async function listConversationMessages(
  authUser: AuthUserInput,
  conversationId: string,
  limit: number,
) {
  const { conversation } = await getAuthorizedConversation(
    conversationId,
    authUser,
  )

  return loadConversationMessages(conversation, limit)
}

export async function createConversationMessage(
  authUser: AuthUserInput,
  conversationId: string,
  input: CreateRoomMessageInput,
) {
  const { conversation, user } = await getAuthorizedConversation(
    conversationId,
    authUser,
  )

  const [message] = await database
    .insert(messagesTable)
    .values({
      conversationId: conversation.id,
      senderId: user.id,
      type: "text",
      content: input.content,
      metadata: input.metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  if (!message) {
    throw createServiceError(500, "message_create_failed")
  }

  await database
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, conversation.id))

  return toMessage(message, user, conversation)
}

export async function getMessage(messageId: string) {
  const [row] = await database
    .select({
      message: messagesTable,
      sender: usersTable,
      conversation: conversationsTable,
    })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .innerJoin(
      conversationsTable,
      eq(messagesTable.conversationId, conversationsTable.id)
    )
    .where(eq(messagesTable.id, messageId))
    .limit(1)

  if (!row) {
    throw createServiceError(404, "message_not_found")
  }

  return toMessage(row.message, row.sender, row.conversation)
}

export async function updateMessage(
  messageId: string,
  input: UpdateMessageInput
) {
  const [message] = await database
    .update(messagesTable)
    .set({
      content: input.content,
      type: input.type,
      metadata: input.metadata,
      editedAt: input.content ? new Date() : undefined,
      deletedAt: input.deletedAt,
      updatedAt: new Date(),
    })
    .where(eq(messagesTable.id, messageId))
    .returning()

  if (!message) {
    throw createServiceError(404, "message_not_found")
  }

  return toMessage(message, null, null)
}

export async function deleteMessage(messageId: string) {
  const [message] = await database
    .update(messagesTable)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(messagesTable.id, messageId))
    .returning()

  if (!message) {
    throw createServiceError(404, "message_not_found")
  }

  return toMessage(message, null, null)
}

export async function listRoomMessages(roomName: string, limit: number) {
  const conversation = await findConversation(roomName)

  if (!conversation) {
    throw createServiceError(404, "conversation_not_found")
  }

  return loadConversationMessages(conversation, limit)
}

export async function createRoomMessage(
  roomName: string,
  authUser: AuthUserInput,
  input: CreateRoomMessageInput
) {
  const user = await ensureUser(authUser)
  const conversation = await ensureConversation(roomName, user)
  await ensureConversationMember(conversation, user)

  const [message] = await database
    .insert(messagesTable)
    .values({
      conversationId: conversation.id,
      senderId: user.id,
      type: "text",
      content: input.content,
      metadata: input.metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  if (!message) {
    throw createServiceError(500, "message_create_failed")
  }

  return toMessage(message, user, conversation)
}

export async function listMessageAttachments(messageId: string) {
  const rows = await database
    .select()
    .from(messageAttachmentsTable)
    .where(eq(messageAttachmentsTable.messageId, messageId))

  return rows.map(toAttachment)
}

export async function createMessageAttachment(
  messageId: string,
  input: CreateMessageAttachmentInput
) {
  const [attachment] = await database
    .insert(messageAttachmentsTable)
    .values({
      messageId,
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      metadata: input.metadata ?? {},
      createdAt: new Date(),
    })
    .returning()

  if (!attachment) {
    throw createServiceError(500, "attachment_create_failed")
  }

  return toAttachment(attachment)
}

export async function updateMessageAttachment(
  attachmentId: string,
  input: UpdateMessageAttachmentInput
) {
  const [attachment] = await database
    .update(messageAttachmentsTable)
    .set(input)
    .where(eq(messageAttachmentsTable.id, attachmentId))
    .returning()

  if (!attachment) {
    throw createServiceError(404, "attachment_not_found")
  }

  return toAttachment(attachment)
}

export async function deleteMessageAttachment(attachmentId: string) {
  const [attachment] = await database
    .delete(messageAttachmentsTable)
    .where(eq(messageAttachmentsTable.id, attachmentId))
    .returning()

  if (!attachment) {
    throw createServiceError(404, "attachment_not_found")
  }

  return toAttachment(attachment)
}

export async function listMessageReactions(messageId: string) {
  const rows = await database
    .select()
    .from(messageReactionsTable)
    .where(eq(messageReactionsTable.messageId, messageId))

  return rows.map(toReaction)
}

export async function createMessageReaction(
  messageId: string,
  input: CreateMessageReactionInput
) {
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

  return reaction ? toReaction(reaction) : null
}

export async function deleteMessageReaction(reactionId: string) {
  const [reaction] = await database
    .delete(messageReactionsTable)
    .where(eq(messageReactionsTable.id, reactionId))
    .returning()

  if (!reaction) {
    throw createServiceError(404, "reaction_not_found")
  }

  return toReaction(reaction)
}

export async function listMessageReceipts(messageId: string) {
  const rows = await database
    .select()
    .from(messageReceiptsTable)
    .where(eq(messageReceiptsTable.messageId, messageId))

  return rows.map(toReceipt)
}

export async function createMessageReceipt(
  messageId: string,
  input: CreateMessageReceiptInput
) {
  const deliveredAt =
    input.status === "delivered" || input.status === "read"
      ? new Date()
      : undefined
  const readAt = input.status === "read" ? new Date() : undefined
  const [receipt] = await database
    .insert(messageReceiptsTable)
    .values({
      messageId,
      userId: input.userId,
      status: input.status,
      deliveredAt,
      readAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [messageReceiptsTable.messageId, messageReceiptsTable.userId],
      set: {
        status: input.status,
        deliveredAt,
        readAt,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!receipt) {
    throw createServiceError(500, "receipt_create_failed")
  }

  return toReceipt(receipt)
}

export async function updateMessageReceipt(
  receiptId: string,
  input: UpdateMessageReceiptInput
) {
  const [receipt] = await database
    .update(messageReceiptsTable)
    .set({
      status: input.status,
      deliveredAt: input.deliveredAt,
      readAt: input.readAt,
      updatedAt: new Date(),
    })
    .where(eq(messageReceiptsTable.id, receiptId))
    .returning()

  if (!receipt) {
    throw createServiceError(404, "receipt_not_found")
  }

  return toReceipt(receipt)
}

export async function deleteMessageReceipt(receiptId: string) {
  const [receipt] = await database
    .delete(messageReceiptsTable)
    .where(eq(messageReceiptsTable.id, receiptId))
    .returning()

  if (!receipt) {
    throw createServiceError(404, "receipt_not_found")
  }

  return toReceipt(receipt)
}
