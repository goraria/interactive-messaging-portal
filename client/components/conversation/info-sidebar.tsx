"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@gorth/primitive/custom/avatar"
import { Badge } from "@gorth/primitive/custom/badge"
import { Button } from "@gorth/primitive/custom/button"
import {
  Bell,
  CircleUserRound,
  Lock,
  Search,
} from "@gorth/primitive/cores/lucide"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@gorth/primitive/custom/sidebar"
import { NavMaster } from "@gorth/primitive/dashboard/nav-main"
import { useUser } from "@/hooks/use-user"
import { infoSidebar } from "@/lib/utils/constant"
import { getConversationPeer } from "@/lib/utils/conversation"
import { getInitials, readRouteId } from "@/lib/utils/formatter"
import { useConversationQuery } from "@/services/chat"

export function InfoSidebar() {
  const params = useParams<{ id?: string | string[] }>()
  const conversationId = readRouteId(params.id)
  const { user } = useUser()
  const conversationQuery = useConversationQuery(
    conversationId,
    Boolean(conversationId && user)
  )
  const conversation = conversationQuery.data ?? null
  const peer = useMemo(
    () => (conversation ? getConversationPeer(conversation, user) : null),
    [conversation, user]
  )
  const name =
    conversation?.type === "direct"
      ? (peer?.name ?? "Conversation")
      : (conversation?.title ?? conversation?.slug ?? "Conversation")
  const subtitle =
    conversation?.type === "direct"
      ? (peer?.email ?? "Direct message")
      : conversation
        ? `${conversation.members.length} members`
        : "type"
  const avatar = conversation?.type === "direct" ? peer?.image : null
  const initials = getInitials(name)

  return (
    <Sidebar
      side="right"
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
    >
      <SidebarHeader className="items-center gap-4 border-b p-6 text-center">
        <Avatar>
          <AvatarImage src={avatar ?? undefined} alt={name} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        {/* <Avatar className="size-32 aspect-square rounded-xl border-4 border-background bg-background shadow-lg">
          <AvatarImage
            src={avatar ?? undefined}
            alt={name}
            width={128}
            height={128}
            className="size-full rounded-lg object-cover"
          />
          <AvatarFallback className="rounded-lg text-2xl font-bold">{initials}</AvatarFallback>
        </Avatar> */}
        <div className="min-w-0">
          <h2 className="truncate font-medium">{name}</h2>
          <p className="text-muted-foreground truncate text-xs">{subtitle}</p>
        </div>

        <Badge>
          <Lock />
          Encrypted
        </Badge>

        <div className="grid w-full grid-cols-3 gap-2">
          <div className="flex min-w-0 flex-col items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="View profile"
            >
              <CircleUserRound />
            </Button>
            <span className="w-full truncate text-xs">Profile</span>
          </div>
          <div className="flex min-w-0 flex-col items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Mute notifications"
            >
              <Bell />
            </Button>
            <span className="w-full truncate text-xs">Mute</span>
          </div>
          <div className="flex min-w-0 flex-col items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Search conversation"
            >
              <Search />
            </Button>
            <span className="w-full truncate text-xs">Search</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMaster items={infoSidebar.navMain} />
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}
