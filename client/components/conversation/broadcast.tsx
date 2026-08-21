"use client"

import { FormEvent, useRef, useState } from "react"
import { Button } from "@gorth/primitive/custom/button"
import { Input } from "@gorth/primitive/default/input"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@gorth/primitive/custom/message-scroller"
import {
  CirclePlus,
  ImagePlus,
  MessageCircleOff,
  Paperclip,
  Send,
} from "@gorth/primitive/cores/lucide"
import { Spinner } from "@gorth/primitive/pattern/spinner"
import { type ChatMessage, useBroadcast } from "@/hooks/use-conversation"
import { Message } from "@/components/conversation/message"
import { ConversationState } from "@/components/conversation/conversation-state"
import { cn } from "@/lib/utils"
import { shouldShowHeader } from "@/lib/utils/conversation"

interface BroadcastProps {
  conversationId: string
  username: string
  userId?: string
  userAvatars?: Record<string, string | null>
  onMessage?: (messages: ChatMessage[]) => void | Promise<void>
  canSend?: boolean
  onSignIn?: () => void
  className?: string
}

export function Broadcast({
  conversationId,
  username,
  userId,
  userAvatars = {},
  onMessage,
  canSend = true,
  onSignIn,
  className,
}: BroadcastProps) {
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const { messages, loading, sending, error, sendMessage } = useBroadcast({
    conversationId,
    username,
    onMessage,
  })
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSend) {
      onSignIn?.()
      return
    }

    const sent = await sendMessage(value)

    if (sent) {
      setValue("")
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  return (
    <section
      className={cn(
        "bg-background flex min-h-0 flex-1 flex-col overflow-hidden border",
        className
      )}
    >
      <MessageScrollerProvider>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-0 p-6">
              {loading ? (
                <ConversationState loading />
              ) : messages.length === 0 ? (
                <ConversationState
                  icon={MessageCircleOff}
                  title="No messages yet"
                  description="Send a message to start the conversation."
                />
              ) : (
                messages.map((message, index) => {
                  const isOwnMessage = Boolean(
                    userId && message.user.id === userId
                  )

                  return (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor={isOwnMessage}
                    >
                      <Message
                        message={message}
                        isOwnMessage={isOwnMessage}
                        showHeader={shouldShowHeader(messages, index)}
                        showAvatar={
                          !messages[index + 1] ||
                          messages[index + 1].user.id !== message.user.id ||
                          new Date(messages[index + 1].createdAt).getTime() -
                            new Date(message.createdAt).getTime() >
                            5 * 60 * 1000
                        }
                        avatar={userAvatars[message.user.id]}
                      />
                    </MessageScrollerItem>
                  )
                })
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {error ? (
        <div className="bg-destructive/10 text-destructive border-t px-4 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        className="flex items-center gap-1 border-t p-3"
      >
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
        />
        <input
          ref={attachmentInputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Add content"
        >
          <CirclePlus />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Add image"
          onClick={() => imageInputRef.current?.click()}
        >
          <ImagePlus />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Attach file"
          onClick={() => attachmentInputRef.current?.click()}
        >
          <Paperclip />
        </Button>
        <Input
          ref={inputRef}
          name={`chat-message-${conversationId}`}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={canSend ? "Type your messages..." : "Sign in to reply"}
          disabled={sending || !canSend}
          maxLength={4000}
          className="text-primary min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label={canSend ? "Send message" : "Sign in"}
          disabled={sending || (canSend && !value.trim())}
        >
          {sending ? <Spinner variant="infinite" size={16} /> : <Send />}
        </Button>
      </form>
    </section>
  )
}
