"use client";

import React, { useMemo, useState } from "react";
import {
  SidebarProvider,
  SidebarInset,
  useSidebar,
} from "@gorth-com/primitive/custom/sidebar";
import { ChatSidebar } from "@/components/conversation/chat-sidebar";
import { InfoSidebar } from "@/components/conversation/info-sidebar";
import { Dashbar } from "@/layouts/dashbar";
import { messageSidebar, visitor } from "@/utils/constant";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { ConversationProvider } from "@/hooks/use-conversation";
import { useConversationsQuery } from "@/queries/chat";
import { toChatConversation } from "@/utils/conversation";
import { AuthGuard } from "@/layouts/guard";
import { IncomingCall } from "@/components/conversation/incoming-call";
import { useLayout } from "@gorth-com/primitive/providers/layout";
import { cn } from "@gorth-com/primitive/cores/cn";

interface MainShellProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  infoOpen: boolean;
  onInfoOpenChange: (open: boolean) => void;
}

function MainShell({
  children,
  sidebar,
  infoOpen,
  onInfoOpenChange,
}: MainShellProps) {
  const { toggleSidebar: toggleLeftSidebar } = useSidebar();
  const { variant, width } = useLayout();

  return (
    <>
      {sidebar}
      <SidebarInset
        className={cn(
          "h-svh min-h-0 overflow-hidden",
          variant === "inset" &&
            "md:my-2 md:mr-2 md:h-[calc(100svh-1rem)] md:rounded-xl",
        )}
      >
        <ConversationProvider open={infoOpen} onOpenChange={onInfoOpenChange}>
          <SidebarProvider
            open={infoOpen}
            onOpenChange={onInfoOpenChange}
            className="relative h-full min-h-0 flex-1 overflow-hidden"
          >
            <div
              data-layout-width={width}
              className="chat-shell relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background"
            >
              <Dashbar onSidebarToggle={toggleLeftSidebar} />
              <main className="flex min-h-0 w-full flex-1 flex-col">
                {children}
              </main>
            </div>
            <InfoSidebar />
          </SidebarProvider>
        </ConversationProvider>
      </SidebarInset>
    </>
  );
}

type MainLayoutProps = Readonly<{
  children: React.ReactNode;
  initialLeftOpen: boolean;
}>;

export function MainLayout({ children, initialLeftOpen }: MainLayoutProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const auth = useAuth();
  const {
    user,
    loading: userLoading,
    error: userError,
    refresh: refreshUser,
  } = useUser();
  const sidebarUser = user
    ? {
        name: user.name,
        email: user.email,
        avatar: user.image ?? "",
      }
    : auth.account
      ? {
          name: auth.account.name,
          email: auth.account.email,
          avatar: auth.account.image ?? "",
        }
      : visitor;
  const conversationsQuery = useConversationsQuery(auth.authenticated);
  const conversations = useMemo(
    () =>
      (conversationsQuery.data ?? []).map((conversation) =>
        toChatConversation(
          conversation,
          user ?? (auth.account ? { externalUserId: auth.account.id } : null),
        ),
      ),
    [conversationsQuery.data, user, auth.account],
  );

  return (
    <AuthGuard>
      <IncomingCall />
      <SidebarProvider
        defaultOpen={initialLeftOpen}
        className="h-svh min-h-0 overflow-hidden"
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
              onRetryConversations={() => {
                void Promise.all([
                  refreshUser(),
                  conversationsQuery.refetch(),
                ]).catch(() => undefined);
              }}
              auth={auth}
            />
          }
        >
          {children}
        </MainShell>
      </SidebarProvider>
    </AuthGuard>
  );
}
