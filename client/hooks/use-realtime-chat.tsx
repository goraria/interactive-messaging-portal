"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@gorth/primitive/cores/tanstack/query"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  chatQueryKeys,
  mergeMessageResults,
  useConversationMessagesQuery,
  useCreateConversationMessageMutation,
} from "@/services/chat"
import { messageSchema, type Message, type MessageType } from "@/schemas/chat"

export interface ChatMessage {
  id: string
  conversationId?: string
  content: string
  type?: MessageType
  metadata?: Message["metadata"]
  user: Message["user"]
  roomName?: string
  editedAt?: string | null
  deletedAt?: string | null
  createdAt: string
  updatedAt?: string
}

interface UseRealtimeChatOptions {
  conversationId: string
  username: string
  onMessage?: (messages: ChatMessage[]) => void | Promise<void>
}

const emptyMessages: ChatMessage[] = []

export function useRealtimeChat({
  conversationId,
  username,
  onMessage,
}: UseRealtimeChatOptions) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const queryClient = useQueryClient()
  const channelRef = useRef<ReturnType<
    NonNullable<typeof supabase>["channel"]
  > | null>(null)
  const messagesQuery = useConversationMessagesQuery(conversationId)
  const sendMutation = useCreateConversationMessageMutation(conversationId)
  const [realtimeState, setRealtimeState] = useState<{
    conversationId: string | null
    error: string | null
  }>({
    conversationId: null,
    error: null,
  })

  const appendMessages = useCallback(
    async (nextMessages: ChatMessage[]) => {
      queryClient.setQueryData<Message[]>(
        chatQueryKeys.messages(conversationId),
        (current = []) =>
          mergeMessageResults(current, nextMessages as Message[])
      )
      void queryClient.invalidateQueries({
        queryKey: chatQueryKeys.conversations,
      })
      await onMessage?.(nextMessages)
    },
    [conversationId, onMessage, queryClient]
  )

  useEffect(() => {
    if (!supabase) {
      return
    }

    const channel = supabase
      .channel(`chat:${conversationId}`, {
        config: {
          broadcast: {
            self: false,
          },
        },
      })
      .on("broadcast", { event: "message" }, (payload) => {
        const result = messageSchema.safeParse(payload.payload)

        if (result.success && result.data.conversationId === conversationId) {
          void appendMessages([result.data])
        }
      })

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setRealtimeState({ conversationId, error: null })
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setRealtimeState({
          conversationId,
          error: "Realtime connection failed",
        })
      }
    })

    channelRef.current = channel

    return () => {
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [appendMessages, conversationId, supabase])

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()

      if (!trimmed || sendMutation.isPending) {
        return null
      }

      try {
        const message = await sendMutation.mutateAsync({
          content: trimmed,
        })
        await onMessage?.([message])
        await channelRef.current?.send({
          type: "broadcast",
          event: "message",
          payload: message,
        })

        return message
      } catch {
        return null
      }
    },
    [onMessage, sendMutation]
  )

  const messages = messagesQuery.data ?? emptyMessages
  const realtimeError = !supabase
    ? "Supabase Realtime is not configured"
    : realtimeState.conversationId === conversationId
      ? realtimeState.error
      : null
  const error =
    realtimeError ??
    messagesQuery.error?.message ??
    sendMutation.error?.message ??
    null

  return {
    messages,
    loading: messagesQuery.isPending,
    sending: sendMutation.isPending,
    error,
    sendMessage,
    username,
    realtimeReady:
      realtimeState.conversationId === conversationId && !realtimeState.error,
  }
}
