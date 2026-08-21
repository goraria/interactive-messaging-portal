"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  SidebarProvider,
  SidebarInset,
  useSidebar,
} from "@/components/primitive/custom"
import { ChatSidebar } from "@/components/conversation/chat-sidebar"
import { InfoSidebar } from "@/components/conversation/info-sidebar"
import { Dashbar } from "@/layouts/dashbar"
import { messageSidebar, visitor } from "@/lib/utils/constant"
import { useAuth } from "@/hooks/use-auth"
import { useUser } from "@/hooks/use-user"
import { ConversationProvider } from "@/hooks/use-conversation"
import { useConversationsQuery } from "@/services/chat"
import { toChatConversation } from "@/lib/utils/conversation"

interface MainShellProps {
  children: React.ReactNode
  sidebar: React.ReactNode
  infoOpen: boolean
  onInfoOpenChange: (open: boolean) => void
}

function MainShell({
  children,
  sidebar,
  infoOpen,
  onInfoOpenChange,
}: MainShellProps) {
  const { toggleSidebar: toggleLeftSidebar } = useSidebar()

  return (
    <>
      {sidebar}
      <SidebarInset className="h-svh min-h-0 overflow-hidden">
        <ConversationProvider open={infoOpen} onOpenChange={onInfoOpenChange}>
          <SidebarProvider
            open={infoOpen}
            onOpenChange={onInfoOpenChange}
            className="min-h-0 flex-1 [--header-height:calc(--spacing(14))]"
          >
            <SidebarInset className="h-full min-h-0 min-w-0 overflow-hidden">
              <Dashbar onSidebarToggle={toggleLeftSidebar} />
              <main className="flex min-h-0 flex-1 flex-col">{children}</main>
            </SidebarInset>
            <InfoSidebar />
          </SidebarProvider>
        </ConversationProvider>
      </SidebarInset>
    </>
  )
}

type MainLayoutProps = Readonly<{
  children: React.ReactNode
  initialLeftOpen: boolean
}>

export function MainLayout({ children, initialLeftOpen }: MainLayoutProps) {
  const router = useRouter()
  const [infoOpen, setInfoOpen] = useState(false)
  const auth = useAuth()
  const { user, loading: userLoading, error: userError } = useUser()
  const sidebarUser = user
    ? {
        name: user.name,
        email: user.email,
        avatar: user.image ?? "",
      }
    : visitor
  const conversationsQuery = useConversationsQuery(
    auth.authenticated && Boolean(user)
  )
  const conversations = useMemo(
    () =>
      (conversationsQuery.data ?? []).map((conversation) =>
        toChatConversation(conversation, user)
      ),
    [conversationsQuery.data, user]
  )

  useEffect(() => {
    if (!auth.loading && !auth.authenticated && !auth.error) {
      router.replace("/")
    }
  }, [auth.authenticated, auth.error, auth.loading, router])

  if (!auth.loading && !auth.authenticated && !auth.error) {
    return null
  }

  return (
    <SidebarProvider
      defaultOpen={initialLeftOpen}
      style={
        {
          "--sidebar-width": "360px",
        } as React.CSSProperties
      }
    >
      <MainShell
        infoOpen={infoOpen}
        onInfoOpenChange={setInfoOpen}
        sidebar={
          <ChatSidebar
            data={{
              ...messageSidebar,
              user: sidebarUser,
              navMessage: conversations,
            }}
            conversationsLoading={
              userLoading ||
              (conversationsQuery.isPending && auth.authenticated)
            }
            conversationsError={
              conversationsQuery.error?.message ?? userError?.message ?? null
            }
            auth={auth}
          />
        }
      >
        {children}
      </MainShell>
    </SidebarProvider>
  )
}
