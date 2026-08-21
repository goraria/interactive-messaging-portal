import type { ConversationDetails, User } from "@/schemas/chat"
import type { ChatConversation } from "@/lib/utils/constant"
import { formatConversationDate } from "@/lib/utils/formatter"

interface MessageHeaderIdentity {
  createdAt: string
  user: {
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
    current.user.name !== previous.user.name ||
    currentTime - previousTime > fiveMinutes
  )
}

export function getConversationPeer(
  conversation: ConversationDetails,
  currentUser: User | null
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
  currentUser: User | null
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
    unread: Boolean(
      conversation.lastMessage &&
      conversation.lastMessage.user.id !== currentUser?.externalUserId
    ),
  }
}
