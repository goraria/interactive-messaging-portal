"use client"

import { createContext, useContext, type ReactNode } from "react"
import { type ChatMessage, useRealtimeChat } from "@/hooks/use-realtime-chat"

interface ConversationContextValue {
  open: boolean
  toggle: () => void
}

const ConversationContext = createContext<ConversationContextValue | undefined>(
  undefined
)

interface ConversationProviderProps {
  children: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConversationProvider({
  children,
  open,
  onOpenChange,
}: ConversationProviderProps) {
  return (
    <ConversationContext.Provider
      value={{ open, toggle: () => onOpenChange(!open) }}
    >
      {children}
    </ConversationContext.Provider>
  )
}

export function useConversation() {
  const context = useContext(ConversationContext)

  if (!context) {
    throw new Error("useConversation must be used within ConversationProvider")
  }

  return context
}

interface UseBroadcastOptions {
  conversationId: string
  username: string
  onMessage?: (messages: ChatMessage[]) => void | Promise<void>
}

export function useBroadcast(options: UseBroadcastOptions) {
  return useRealtimeChat(options)
}

export type { ChatMessage }
