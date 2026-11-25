"use client";

import { Button } from "@gorth-com/primitive/custom/button";
import { NavIdentity } from "@gorth-com/primitive/dashboard/nav-user";
import { Info } from "@gorth-com/primitive/cores/lucide";
import { ChatCallControls } from "@/components/conversation/call-controls";
import { cn } from "@gorth-com/primitive/cores/cn";
import { useLayout } from "@gorth-com/primitive/providers/layout";
import { useConversation } from "@/hooks/use-conversation";

interface MessHeaderProps {
  conversationName: string;
  avatar?: string | null;
  subtitle: string;
  conversationId?: string;
  userId?: string;
  callsEnabled?: boolean;
}

export function MessHeader({
  conversationName,
  avatar,
  subtitle,
  conversationId,
  userId,
  callsEnabled = false,
}: MessHeaderProps) {
  const { open: infoOpen, toggle: toggleInfoSidebar } = useConversation();
  const { variant, width } = useLayout();

  return (
    <header
      className={cn(
        "bg-card h-14 shrink-0",
        variant === "sidebar" && "border-b shadow-sm",
        variant === "floating" &&
          "rounded-lg shadow-sm ring-1 ring-sidebar-border",
        variant === "inset" && "border-b",
      )}
    >
      <div
        className={cn(
          "flex h-full w-full items-center justify-between px-6",
          width === "narrow" && "container mx-auto",
        )}
      >
        <h1 className="sr-only">{conversationName}</h1>
        <NavIdentity
          user={{ name: conversationName, avatar }}
          description={subtitle}
          hover
        />

        <div className="flex shrink-0 items-center gap-2">
          {conversationId && userId ? (
            <ChatCallControls
              key={conversationId}
              conversationId={conversationId}
              userId={userId}
              enabled={callsEnabled}
            />
          ) : null}
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
      </div>
    </header>
  );
}
