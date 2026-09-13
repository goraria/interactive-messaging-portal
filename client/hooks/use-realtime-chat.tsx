"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Message as AblyMessage } from "@gorth/structure/cores/ably/index"
import { useQueryClient } from "@gorth/primitive/cores/tanstack/query"
import { createAblyClient, getMessageChannelName } from "@/lib/ably/client"
import {
  chatQueryKeys,
  getMessage,
  mergeMessageResults,
  useConversationMessagesQuery,
  useCreateConversationMessageMutation,
} from "@/services/chat"
import {
  messageSchema,
  type ConversationDetails,
  type Message,
  type MessageType,
} from "@/schemas/chat"

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
  const ably = useMemo(() => createAblyClient(conversationId), [conversationId])
  const queryClient = useQueryClient()
  const mountedRef = useRef(true)
  const messagesQuery = useConversationMessagesQuery(conversationId)
  const [sendMessageMutation, sendState] =
    useCreateConversationMessageMutation(conversationId)
  const [realtimeState, setRealtimeState] = useState<{
    conversationId: string | null
    error: string | null
  }>({
    conversationId: null,
    error: null,
  })

  const appendMessages = useCallback(
    async (nextMessages: ChatMessage[]) => {
      const latestMessage = nextMessages.at(-1) as Message | undefined

      queryClient.setQueryData<Message[]>(
        chatQueryKeys.messages(conversationId),
        (current = []) =>
          mergeMessageResults(current, nextMessages as Message[])
      )

      if (latestMessage) {
        const updateConversation = (conversation: ConversationDetails) => {
          const shouldUpdate =
            !conversation.lastMessage ||
            conversation.lastMessage.id === latestMessage.id ||
            new Date(latestMessage.createdAt).getTime() >=
            new Date(conversation.lastMessage.createdAt).getTime()

          return shouldUpdate
            ? {
              ...conversation,
              lastMessage: latestMessage,
              updatedAt: latestMessage.createdAt,
            }
            : conversation
        }

        queryClient.setQueryData<ConversationDetails>(
          chatQueryKeys.conversation(conversationId),
          (current) => (current ? updateConversation(current) : current)
        )
        queryClient.setQueriesData<ConversationDetails[]>(
          { queryKey: chatQueryKeys.conversations },
          (current) =>
            current
              ? current
                .map((conversation) =>
                  conversation.id === conversationId
                    ? updateConversation(conversation)
                    : conversation
                )
                .toSorted(
                  (left, right) =>
                    new Date(right.updatedAt).getTime() -
                    new Date(left.updatedAt).getTime()
                )
              : current
        )
      }

      await onMessage?.(nextMessages)
    },
    [conversationId, onMessage, queryClient]
  )

  useEffect(() => {
    mountedRef.current = true
    const channel = ably.channels.get(getMessageChannelName(conversationId))
    const receiveMessage = (event: AblyMessage) => {
      if (
        event.data?.conversationId !== conversationId ||
        typeof event.data?.messageId !== "string"
      ) {
        return
      }

      const parsedMessage = messageSchema.safeParse(event.data.message)

      if (parsedMessage.success) {
        void appendMessages([parsedMessage.data])
        return
      }

      const cachedMessages = queryClient.getQueryData<Message[]>(
        chatQueryKeys.messages(conversationId)
      )

      if (cachedMessages?.some(({ id }) => id === event.data.messageId)) return

      void getMessage(event.data.messageId).then((message) =>
        appendMessages([message])
      )
    }

    const connect = async () => {
      try {
        ably.connect()
        await Promise.all([
          channel.subscribe("message.created", receiveMessage),
          channel.subscribe("message.updated", receiveMessage),
          channel.subscribe("message.deleted", receiveMessage),
        ])

        if (mountedRef.current) {
          setRealtimeState({ conversationId, error: null })
        }
      } catch {
        if (mountedRef.current) {
          setRealtimeState({
            conversationId,
            error: "Realtime connection failed",
          })
        }
      }
    }

    void connect()

    return () => {
      mountedRef.current = false
      channel.unsubscribe()
      ably.close()
    }
  }, [ably, appendMessages, conversationId, queryClient])

  const realtimeReady =
    realtimeState.conversationId === conversationId && !realtimeState.error
  const realtimeError =
    realtimeState.conversationId === conversationId
      ? realtimeState.error
      : null

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()

      if (!realtimeReady || !trimmed || sendState.isLoading) {
        return null
      }

      try {
        const message = await sendMessageMutation({
          content: trimmed,
        }).unwrap()
        await appendMessages([message])

        return message
      } catch {
        return null
      }
    },
    [appendMessages, realtimeReady, sendMessageMutation, sendState.isLoading]
  )

  const messages = messagesQuery.data ?? emptyMessages
  const error =
    messagesQuery.error?.message ??
    sendState.error?.message ??
    null

  return {
    messages,
    loading: messagesQuery.isPending,
    sending: sendState.isLoading,
    error,
    sendMessage,
    username,
    realtimeReady,
    realtimeError: Boolean(realtimeError),
  }
}
