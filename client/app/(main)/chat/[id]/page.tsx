"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@gorth/primitive/custom/button"
import { MessageCircleOff, TriangleAlert } from "@gorth/primitive/cores/lucide"
import { Broadcast } from "@/components/conversation/broadcast"
import { ConversationState } from "@/components/conversation/conversation-state"
import { MessHeader } from "@/components/conversation/mess-header"
import { useAccount } from "@/hooks/use-user"
import { getConversationPeer } from "@/lib/utils/conversation"
import { readRouteId } from "@/lib/utils/formatter"
import { useConversationQuery } from "@/services/chat"

export default function ChatConversationPage() {
  const params = useParams<{ id?: string | string[] }>()
  const id = readRouteId(params.id)
  const { user, sidebarUser, auth } = useAccount()
  const conversationQuery = useConversationQuery(
    id,
    auth.authenticated && Boolean(user)
  )
  const conversation = conversationQuery.data ?? null
  const peer = useMemo(
    () => (conversation ? getConversationPeer(conversation, user) : null),
    [conversation, user]
  )

  if (auth.loading || (user && conversationQuery.isPending)) {
    return <ConversationState loading className="h-full" />
  }

  if (conversationQuery.error) {
    return (
      <ConversationState
        icon={TriangleAlert}
        title="Unable to load conversation"
        description={conversationQuery.error.message}
        className="h-full"
      />
    )
  }

  if (!conversation) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <ConversationState
          icon={MessageCircleOff}
          title="Conversation not found"
          description="This message thread is unavailable."
          className="min-h-0"
        />
        <Button
          render={<Link href="/chat" />}
          nativeButton={false}
        >
          Back to inbox
        </Button>
      </main>
    )
  }

  const conversationName =
    conversation.type === "direct"
      ? (peer?.name ?? conversation.title ?? "Direct message")
      : (conversation.title ?? conversation.slug ?? "Conversation")
  const subtitle =
    conversation.type === "direct"
      ? (peer?.email ?? "Direct message")
      : `${conversation.members.length} members`
  const avatar = conversation.type === "direct" ? peer?.image : null
  const userAvatars = Object.fromEntries(
    conversation.members.map((member) => [member.externalUserId, member.image])
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MessHeader
        conversationName={conversationName}
        avatar={avatar}
        subtitle={subtitle}
      />
      <Broadcast
        key={conversation.id}
        conversationId={conversation.id}
        username={sidebarUser.name}
        userId={user?.externalUserId ?? auth.account?.id}
        userAvatars={userAvatars}
        canSend={Boolean(user)}
      />
    </div>
  )
}
