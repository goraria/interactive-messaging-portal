import { v4 } from "@gorth/structure/cores/uuid"
import type {
  ConversationMemberRow,
  ConversationRow,
  MessageAttachmentRow,
  MessageReactionRow,
  MessageReceiptRow,
  MessageRow,
  UserRow,
} from "@/database/schema"

export function slugifyConversation(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)

  return slug || `conversation-${v4()}`
}

export function toUser(row: UserRow) {
  return {
    id: row.id,
    externalUserId: row.externalUserId,
    name: row.name,
    username: row.username,
    role: row.role,
    status: row.status,
    email: row.email,
    image: row.image,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    syncedAt: row.syncedAt.toISOString(),
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toConversation(row: ConversationRow) {
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

export function toConversationMember(row: ConversationMemberRow) {
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

export function toMessage(
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

export function toMessageAttachment(row: MessageAttachmentRow) {
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

export function toMessageReaction(row: MessageReactionRow) {
  return {
    id: row.id,
    messageId: row.messageId,
    userId: row.userId,
    emoji: row.emoji,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toMessageReceipt(row: MessageReceiptRow) {
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
