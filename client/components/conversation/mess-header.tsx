"use client"

import { Button } from "@gorth/primitive/custom/button"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@gorth/primitive/custom/avatar"
import { Info, Phone, Video } from "@gorth/primitive/cores/lucide"
import { cn } from "@gorth/primitive/lib/utils"
import { useLayout } from "@gorth/primitive/providers/layout"
import { useConversation } from "@/hooks/use-conversation"
import { getInitials } from "@/lib/utils/formatter"

interface MessHeaderProps {
  conversationName: string
  avatar?: string | null
  subtitle: string
}

export function MessHeader({
  conversationName,
  avatar,
  subtitle,
}: MessHeaderProps) {
  const { open: infoOpen, toggle: toggleInfoSidebar } = useConversation()
  const { variant } = useLayout()
  const initials = getInitials(conversationName)

  return (
    <header
      className={cn(
        "bg-card flex h-14 shrink-0 items-center justify-between px-6",
        variant === "sidebar" && "border-b shadow-sm",
        variant === "floating" &&
        "rounded-lg shadow-sm ring-1 ring-sidebar-border",
        variant === "inset" && "rounded-t-xl border"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar>
          <AvatarImage src={avatar ?? undefined} alt={conversationName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="text-foreground truncate text-sm font-medium sm:text-base">
            {conversationName}
          </h1>
          <p className="text-muted-foreground truncate text-xs sm:text-sm">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Start video call"
        >
          <Video />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Start voice call"
        >
          <Phone />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={
            infoOpen ? "Close conversation info" : "Open conversation info"
          }
          title={
            infoOpen ? "Close conversation info" : "Open conversation info"
          }
          aria-pressed={infoOpen}
          onClick={toggleInfoSidebar}
        >
          <Info />
        </Button>
      </div>
    </header>
  )
}
