"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { Badge } from "@gorth-io/primitive/custom/badge"
import { Button } from "@gorth-io/primitive/custom/button"
import {
  Lock,
  ArrowLeft,
  UserRound,
} from "@gorth-io/primitive/cores/lucide"
import { infoSidebar } from "@/utils/constant"
import { NavProfile } from "@gorth-io/primitive/dashboard/nav-user"
import { NavMaster } from "@gorth-io/primitive/dashboard/nav-main"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@gorth-io/primitive/custom/sidebar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@gorth-io/primitive/default/dialog"
import { InfoMute } from "@/components/conversation/info-mute"
import { InfoAssets } from "@/components/conversation/info-assets"
import { cn } from "@gorth-io/primitive/cores/cn"
import { useLayout } from "@gorth-io/primitive/providers/layout"
import { useUser } from "@/hooks/use-user"
import { getConversationPeer } from "@/utils/conversation"
import { readRouteId } from "@/utils/client/formatter"
import { useConversationQuery } from "@/services/client/chat"
import { ConversationTools } from "@/components/conversation/conversation-tools"

export function InfoSidebar() {
  const { variant } = useLayout()
  const params = useParams<{ id?: string | string[] }>()
  const conversationId = readRouteId(params.id)
  const [screen, setScreen] = useState<{
    id: string
    view: "members" | "search" | "settings" | "media" | "files" | "links"
  } | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [muteOpen, setMuteOpen] = useState(false)
  const view = screen?.id === conversationId ? screen.view : null
  const { user } = useUser()
  const conversationQuery = useConversationQuery(
    conversationId,
    Boolean(conversationId && user)
  )
  const conversation = conversationQuery.data ?? null
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!conversation?.mutedUntil) return
    const remaining = new Date(conversation.mutedUntil).getTime() - Date.now()
    if (remaining <= 0) return
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(remaining + 1, 2147483647)
    )
    return () => clearTimeout(timer)
  }, [conversation?.mutedUntil, now])
  const muted = Boolean(
    conversation?.mutedUntil &&
    new Date(conversation.mutedUntil).getTime() > now
  )
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

  return (
    <Sidebar
      side="right"
      variant={variant}
      collapsible="offcanvas"
      className={cn(
        "absolute! inset-y-0! h-full! *:data-[sidebar=sidebar]:overflow-hidden",
        variant === "inset" && "*:data-[sidebar=sidebar]:rounded-lg"
      )}
    >
      {view ? (
        <SidebarHeader className="flex-row items-center gap-2 border-b p-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to conversation info"
            onClick={() => setScreen(null)}
          >
            <ArrowLeft />
          </Button>
          <h2 className="font-medium capitalize">
            {view === "settings" ? "Chat settings" : view === "media" || view === "files" || view === "links" ? "Media, files and links" : view}
          </h2>
        </SidebarHeader>
      ) : (
        <SidebarHeader className="items-center gap-4 border-b p-6 text-center">
          <NavProfile user={{ name, avatar }} />
          <div className="w-full min-w-0">
            <h2 className="truncate font-medium">{name}</h2>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>

          <Badge>
            <Lock />
            Transport protected
          </Badge>
          <div className="grid w-full grid-cols-3 gap-2">
            {infoSidebar.actions.map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center gap-1"
              >
                {item.label === "Mute" ? (
                  <InfoMute key={String(muted)} conversationId={conversationId} muted={muted} open={muteOpen} onOpenChange={setMuteOpen} />
                ) : (
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={
                      item.view === "members" && conversation?.type === "direct"
                        ? "Profile"
                        : item.label
                    }
                    onClick={() => {
                      if (
                        item.view === "members" &&
                        conversation?.type === "direct"
                      )
                        setProfileOpen(true)
                      else setScreen({ id: conversationId, view: item.view })
                    }}
                  >
                    {item.view === "members" &&
                      conversation?.type === "direct" ? (
                      <UserRound />
                    ) : (
                      <item.icon />
                    )}
                  </Button>
                )}
                <span className="text-xs">
                  {item.view === "members" && conversation?.type === "direct"
                    ? "Profile"
                    : item.label}
                </span>
              </div>
            ))}
          </div>
        </SidebarHeader>
      )}
      <SidebarContent>
        {view === "media" || view === "files" || view === "links" ? (
          <InfoAssets
            key={"assets:" + conversationId}
            conversationId={conversationId}
            kind={view}
            onKindChange={(kind) => setScreen({ id: conversationId, view: kind })}
          />
        ) : view ? (
          <ConversationTools
            key={conversationId + view}
            conversationId={conversationId}
            view={view}
          />
        ) : null}
          <div key={"navigation:" + conversationId} hidden={Boolean(view)} onClickCapture={(event) => {
            const href = (event.target as Element).closest("a")?.getAttribute("href")
            const target = href?.startsWith("#") ? href.slice(1) : null
            if (target?.startsWith("todo-")) {
              event.preventDefault()
              event.stopPropagation()
              return
            }
            if (target === "mute" || target === "members" || target === "search" || target === "settings" || target === "media" || target === "files" || target === "links") {
              event.preventDefault()
              event.stopPropagation()
              if (target === "mute") setMuteOpen(true)
              else setScreen({ id: conversationId, view: target })
            }
          }}>
            <NavMaster items={[
              ...infoSidebar.navMain.filter((group) => !group.groupOnly || conversation?.type !== "direct"),
              ...(conversation?.type === "direct" ? infoSidebar.navSub : infoSidebar.navGroup),
            ]} />
          </div>
      </SidebarContent>
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Profile</DialogTitle>
            <DialogDescription>Conversation partner</DialogDescription>
          </DialogHeader>
          <NavProfile
            user={{ name: peer?.name ?? name, avatar: peer?.image }}
          />
          <p className="font-medium">{peer?.name ?? name}</p>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}
