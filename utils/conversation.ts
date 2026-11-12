import type { ConversationDetails, User } from "@/schemas/client/chat"
import type { ChatConversation } from "@/utils/constant"
import { formatConversationDate } from "@/utils/client/formatter"

interface MessageHeaderIdentity {
  createdAt: string
  user: {
    id?: string
    name: string
  }
}

export function shouldShowHeader<TMessage extends MessageHeaderIdentity>(
  messages: TMessage[],
  index: number
) {
  const current = messages[index]
  const previous = messages[index - 1]

  if (!current || !previous) return true

  const currentTime = new Date(current.createdAt).getTime()
  const previousTime = new Date(previous.createdAt).getTime()
  const fiveMinutes = 5 * 60 * 1000

  return (
    (current.user.id && previous.user.id
      ? current.user.id !== previous.user.id
      : current.user.name !== previous.user.name) ||
    currentTime - previousTime > fiveMinutes
  )
}

export function shouldShowFooter<TMessage extends MessageHeaderIdentity>(
  messages: TMessage[],
  index: number
) {
  return Boolean(messages[index]) &&
    (index === messages.length - 1 || shouldShowHeader(messages, index + 1))
}

interface ReceiptMessage extends MessageHeaderIdentity {
  receipts: { userId: string; status: string }[]
}

export function getLastReadBlockIndex<TMessage extends ReceiptMessage>(
  messages: TMessage[],
  currentUserId?: string
) {
  if (!currentUserId) return -1
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]!
    if (
      message.user.id === currentUserId &&
      shouldShowFooter(messages, index) &&
      message.receipts.some((receipt) =>
        receipt.status === "read" && receipt.userId !== currentUserId
      )
    )
      return index
  }
  return -1
}

export function getConversationPeer(
  conversation: ConversationDetails,
  currentUser: Pick<User, "externalUserId"> | null
) {
  return (
    conversation.members.find(
      (member) => member.externalUserId !== currentUser?.externalUserId
    ) ??
    conversation.members[0] ??
    null
  )
}

export function toChatConversation(
  conversation: ConversationDetails,
  currentUser: Pick<User, "externalUserId"> | null
): ChatConversation {
  const peer = getConversationPeer(conversation, currentUser)
  const isDirect = conversation.type === "direct"
  const activityAt =
    conversation.lastMessage?.createdAt ?? conversation.updatedAt

  return {
    id: conversation.id,
    roomName: conversation.id,
    url: `/chat/${encodeURIComponent(conversation.id)}`,
    name: isDirect
      ? (peer?.name ?? conversation.title ?? "Direct message")
      : (conversation.title ?? conversation.slug),
    avatar: isDirect ? peer?.image : null,
    email: isDirect
      ? (peer?.email ?? "")
      : `${conversation.members.length} members`,
    subject: isDirect ? "Direct message" : conversation.type,
    date: formatConversationDate(activityAt),
    teaser: conversation.lastMessage?.content ?? "No messages yet",
    createdAt: activityAt,
    unread: conversation.unreadCount > 0,
    archived: Boolean(conversation.archivedAt),
  }
}
