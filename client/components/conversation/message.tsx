import { cn } from "@gorth/primitive/lib/utils"
import type { ChatMessage } from "@/hooks/use-conversation"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@gorth/primitive/custom/avatar"
import { formatMessageTime, getInitials } from "@/lib/utils/formatter"

interface MessageProps {
  message: ChatMessage
  isOwnMessage: boolean
  showHeader: boolean
  showAvatar: boolean
  avatar?: string | null
}

export function Message({
  message,
  isOwnMessage,
  showHeader,
  showAvatar,
  avatar,
}: MessageProps) {
  const initials = getInitials(message.user.name)

  return (
    <div
      className={cn(
        "mt-2 flex items-end gap-2",
        isOwnMessage ? "flex-row-reverse justify-start" : "justify-start"
      )}
    >
      {showAvatar ? (
        <Avatar>
          <AvatarImage src={avatar ?? undefined} alt={message.user.name} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      ) : (
        <div className="size-9 shrink-0" aria-hidden="true" />
      )}
      <div
        style={{ maxWidth: "18rem" }}
        className={cn(
          "flex w-fit min-w-0 flex-col gap-1",
          isOwnMessage && "items-end"
        )}
      >
        {showHeader ? (
          <div
            className={cn(
              "flex items-center gap-2 px-3 text-xs",
              isOwnMessage && "flex-row-reverse justify-end"
            )}
          >
            <span className="font-medium">{message.user.name}</span>
            <span className="text-foreground/50">
              {formatMessageTime(message.createdAt)}
            </span>
          </div>
        ) : null}
        <div
          style={{
            maxWidth: "18rem",
            overflowWrap: "anywhere",
            whiteSpace: "pre-wrap",
          }}
          className={cn(
            "w-fit min-w-0 rounded-md px-3 py-2 text-sm wrap-break-word whitespace-pre-wrap",
            isOwnMessage
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground"
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  )
}
