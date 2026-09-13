"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@gorth/primitive/custom/button"
import { MessageCircleOff, TriangleAlert } from "@gorth/primitive/cores/lucide"
import { cn } from "@gorth/primitive/lib/utils"
import { useLayout } from "@gorth/primitive/providers/layout"
import { Broadcast } from "@/components/conversation/broadcast"
import { ConversationState } from "@/components/conversation/conversation-state"
import { MessHeader } from "@/components/conversation/mess-header"
import { useAuth } from "@/hooks/use-auth"
import { useUser } from "@/hooks/use-user"
import { visitor } from "@/lib/utils/constant"
import { getConversationPeer } from "@/lib/utils/conversation"
import { readRouteId } from "@/lib/utils/formatter"
import { useConversationQuery } from "@/services/chat"

export default function ChatConversationPage() {
  const { variant } = useLayout()
  const params = useParams<{ id?: string | string[] }>()
  const id = readRouteId(params.id)
  const auth = useAuth()
  const { user, loading: userLoading } = useUser()
  const conversationQuery = useConversationQuery(
    id,
    auth.authenticated && Boolean(user)
  )
  const conversation = conversationQuery.data ?? null
  const peer = useMemo(
    () => (conversation ? getConversationPeer(conversation, user) : null),
    [conversation, user]
  )

  if (auth.loading || userLoading || (user && conversationQuery.isPending)) {
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
        <Button render={<Link href="/chat" />} nativeButton={false}>
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
    <div
      className={cn(
        "flex h-full min-h-0 flex-col",
        variant === "floating" && "gap-2 px-2 pb-2",
        variant === "inset" && "overflow-hidden rounded-b-xl"
      )}
    >
      <MessHeader
        conversationName={conversationName}
        avatar={avatar}
        subtitle={subtitle}
      />
      <Broadcast
        key={conversation.id}
        conversationId={conversation.id}
        username={user?.name ?? visitor.name}
        userId={user?.externalUserId ?? auth.account?.id}
        userAvatars={userAvatars}
        canSend={Boolean(user)}
      />
    </div>
  )
}
