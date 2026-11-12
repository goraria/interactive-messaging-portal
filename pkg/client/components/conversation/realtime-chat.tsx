"use client"

import { useMemo } from "react"
import { Broadcast } from "@/components/conversation/broadcast"
import { useUser } from "@/hooks/use-user"
import type { ChatMessage } from "@/hooks/use-conversation"

interface RealtimeChatProps {
  /** Conversation UUID – used as the Ably channel key */
  conversationId: string
  /** Display name shown in the message list header */
  title: string
  /** Current user's display name sent with every message */
  username: string
  /** Current user's id – used to distinguish own messages */
  userId?: string
  /** Whether the user is allowed to send messages */
  canSend?: boolean
  /** Called after a message is sent or received */
  onMessage?: (messages: ChatMessage[]) => void | Promise<void>
  /** Called when the unauthenticated user tries to send */
  onSignIn?: () => void
  className?: string
}

/**
 * RealtimeChat
 *
 * Thin wrapper around the project's {@link Broadcast} component.
 * - Fetches member avatars from the user hook so peer avatars appear in the
 *   message list automatically.
 * - Wires conversationId to its scoped Ably message channel.
 * - Persists messages to the server via the TanStack Query mutation inside
 *   `useRealtimeChat` (called by Broadcast → useBroadcast).
 */
export function RealtimeChat({
  conversationId,
  title: _title,
  username,
  userId,
  canSend = true,
  onMessage,
  onSignIn,
  className,
}: RealtimeChatProps) {
  const { user } = useUser()

  /** Build a simple id→avatar map from the current user so own avatar shows. */
  const userAvatars = useMemo<Record<string, string | null>>(() => {
    if (!user?.externalUserId) return {}
    return { [user.externalUserId]: user.image ?? null }
  }, [user])

  return (
    <Broadcast
      conversationId={conversationId}
      username={username}
      userId={userId}
      userAvatars={userAvatars}
      onMessage={onMessage}
      canSend={canSend}
      onSignIn={onSignIn}
      className={className}
    />
  )
}
