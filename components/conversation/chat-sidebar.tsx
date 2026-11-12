"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@gorth-io/primitive/custom/sidebar"
import { Button } from "@gorth-io/primitive/custom/button"
import { Label } from "@gorth-io/primitive/default/label"
import { Switch } from "@gorth-io/primitive/default/switch"
import {
  Command as CommandRoot,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@gorth-io/primitive/custom/command"
import { cn } from "@gorth-io/primitive/cores/cn"
import { useLayout } from "@gorth-io/primitive/providers/layout"
import {
  Dot,
  Command as CommandIcon,
  MessageCircleOff,
  Search,
  SearchX,
  RefreshCw,
  SquarePen,
  TriangleAlert,
  X,
  type LucideIcon,
} from "@gorth-io/primitive/cores/lucide"
import { NavIdentity, NavUser } from "@gorth-io/primitive/dashboard/nav-user"
import { ConversationState } from "@/components/conversation/conversation-state"
import type { ChatConversation } from "@/utils/constant"
import type { useAuth } from "@/hooks/use-auth"
import { useNetworkErrorToast } from "@/hooks/use-network-error-toast"

type SidebarData = {
  user: {
    name: string
    email: string
    avatar: string
  }
  brand?: {
    name: string
    logo?: string
    plan?: string
  }
  navMain: Array<{
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
  }>
  navDropdown: Array<{
    title: string
    url: string
    icon: LucideIcon
  }>
  navSignal: Array<{
    title: string
    url: string
    icon: LucideIcon
  }>
  navMessage: ChatConversation[]
}

type AuthControls = Pick<
  ReturnType<typeof useAuth>,
  "authenticated" | "loading" | "logout" | "login" | "register"
>

interface ChatSidebarProps extends React.ComponentProps<typeof Sidebar> {
  data: SidebarData
  auth: AuthControls
  conversationsLoading?: boolean
  conversationsError?: string | null
  onRetryConversations?: () => void
}

export function ChatSidebar({
  data,
  auth,
  conversationsLoading = false,
  conversationsError = null,
  onRetryConversations,
  className,
  ...props
}: ChatSidebarProps) {
  const pathname = usePathname()
  const networkError = useNetworkErrorToast(conversationsError)
  const router = useRouter()
  const [activeItem, setActiveItem] = React.useState(data.navMain[0])
  const [unreadOnly, setUnreadOnly] = React.useState(false)
  const [searching, setSearching] = React.useState(false)
  const { setOpen } = useSidebar()
  const { collapsible, variant } = useLayout()
  const conversations = React.useMemo(
    () =>
      data.navMessage.filter(
        (conversation) =>
          (activeItem?.title === "Archived"
            ? conversation.archived
            : !conversation.archived) &&
          (!unreadOnly || conversation.unread) &&
          (activeItem?.title !== "Groups" ||
            conversation.subject === "group" ||
            conversation.subject === "channel")
      ),
    [data.navMessage, unreadOnly, activeItem]
  )

  return (
    <Sidebar
      {...props}
      collapsible={collapsible}
      variant={variant}
      className={cn(
        "overflow-hidden *:data-[sidebar=sidebar]:flex-row *:data-[sidebar=sidebar]:overflow-hidden",
        className
      )}
    >
      <Sidebar
        collapsible="none"
        className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="default"
                render={<Link href="/" />}
                className="group-data-[collapsible=icon]:p-0! md:p-0"
              >
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-9 items-center justify-center rounded-md">
                  {data.brand?.logo ? (
                    <Image
                      src={data.brand.logo}
                      alt={data.brand.name}
                      width={36}
                      height={36}
                      className="size-9"
                    />
                  ) : (
                    <CommandIcon className="size-4" />
                  )}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate text-xl font-medium">
                    {data.brand?.name ?? "Gortheia"}
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {data.navMain.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={{
                        children: item.title,
                        hidden: false,
                      }}
                      onClick={() => {
                        if (item.url.startsWith("/")) {
                          router.push(item.url)
                          return
                        }
                        setActiveItem(item)
                        setOpen(true)
                      }}
                      isActive={activeItem?.title === item.title}
                      className="px-2.5"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="items-center p-1.5">
          <NavUser
            user={data.user}
            type="navbar"
            side="right"
            size="icon"
            auth={{
              ...auth,
              logout: async () => {
                await auth.logout()
              },
            }}
            nav={{
              main: data.navDropdown,
              secondary: data.navSignal,
            }}
          />
        </SidebarFooter>
      </Sidebar>

      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <CommandRoot className="min-h-0 flex-1 rounded-none bg-transparent p-0">
          <SidebarHeader className="gap-4 border-b p-4">
            <div className="flex w-full items-center justify-between">
              <div className="text-foreground text-base font-medium">
                {activeItem?.title}
              </div>
              <div className="flex items-center gap-2">
                <Label className="flex items-center gap-2 text-sm">
                  <span>Unreads</span>
                  <Switch
                    checked={unreadOnly}
                    onCheckedChange={setUnreadOnly}
                    className="shadow-none"
                  />
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={
                    searching
                      ? "Close conversation search"
                      : "Search conversations"
                  }
                  onClick={() => setSearching((current) => !current)}
                >
                  {searching ? <X /> : <SquarePen />}
                </Button>
              </div>
            </div>
            {searching ? (
              <CommandInput
                autoFocus
                placeholder="Type to search..."
                className="placeholder:text-muted-foreground"
                wrapperClassName="p-0"
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                className="border-input/30 bg-input/30 text-muted-foreground hover:bg-input/30 h-9 w-full min-w-0 justify-start px-2 font-normal shadow-none!"
                aria-label="Search conversations"
                onClick={() => setSearching(true)}
              >
                <Search />
                <span className="truncate">Type to search...</span>
              </Button>
            )}
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup className="min-w-0 overflow-hidden p-2">
              <SidebarGroupContent className="max-w-full min-w-0 overflow-hidden">
                {conversationsLoading ? (
                  <ConversationState loading />
                ) : conversationsError ? (
                  <ConversationState
                    icon={TriangleAlert}
                    title="Unable to load conversations"
                    description={
                      networkError
                        ? undefined
                        : conversationsError === "auth_unavailable" ||
                            conversationsError === "unavailable"
                          ? "Authentication check is unavailable. Your session has been kept."
                          : conversationsError
                    }
                  >
                    {onRetryConversations ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onRetryConversations}
                      >
                        <RefreshCw />
                        Try again
                      </Button>
                    ) : null}
                  </ConversationState>
                ) : data.navMessage.length === 0 ? (
                  <ConversationState
                    icon={MessageCircleOff}
                    title="No conversations yet"
                    description="Start a new message to see it here."
                  />
                ) : searching ? (
                  <CommandList className="max-h-none">
                    <CommandEmpty>
                      <ConversationState
                        icon={SearchX}
                        title={
                          unreadOnly
                            ? "No unread conversations"
                            : "No conversations found"
                        }
                        description="Try another search."
                      />
                    </CommandEmpty>
                    <CommandGroup className="p-0">
                      <SidebarMenu>
                        {conversations.map((conversation) => (
                          <SidebarMenuItem key={conversation.id}>
                            <CommandItem
                              className="h-auto min-w-0"
                              value={`${conversation.name} ${conversation.email} ${conversation.teaser}`}
                              variant="plain"
                              showCheck={false}
                              onSelect={() => {
                                setSearching(false)
                                router.push(conversation.url)
                              }}
                            >
                              <SidebarMenuButton
                                render={
                                  <Link
                                    href={conversation.url}
                                    onClick={() => setSearching(false)}
                                  />
                                }
                                isActive={pathname === conversation.url}
                                className="h-auto min-w-0 p-2.5"
                              >
                                <NavIdentity
                                  user={{
                                    name: conversation.name,
                                    avatar: conversation.avatar,
                                  }}
                                  description={conversation.teaser}
                                  hover
                                  trailing={
                                    <div className="grid shrink-0 justify-items-end gap-1">
                                      {conversation.date ? (
                                        <span className="text-muted-foreground text-xs">
                                          {conversation.date}
                                        </span>
                                      ) : null}
                                      {conversation.unread ? (
                                        <Dot
                                          className="text-primary size-4"
                                          aria-label="Unread"
                                        />
                                      ) : null}
                                    </div>
                                  }
                                />
                              </SidebarMenuButton>
                            </CommandItem>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </CommandGroup>
                  </CommandList>
                ) : conversations.length === 0 ? (
                  <ConversationState
                    icon={MessageCircleOff}
                    title="No unread conversations"
                    description="All caught up."
                  />
                ) : (
                  <SidebarMenu>
                    {conversations.map((conversation) => (
                      <SidebarMenuItem key={conversation.id}>
                        <SidebarMenuButton
                          render={<Link href={conversation.url} />}
                          isActive={pathname === conversation.url}
                          className="h-auto min-w-0 p-2.5"
                        >
                          <NavIdentity
                            user={{
                              name: conversation.name,
                              avatar: conversation.avatar,
                            }}
                            description={conversation.teaser}
                            hover
                            trailing={
                              <div className="grid shrink-0 justify-items-end gap-1">
                                {conversation.date ? (
                                  <span className="text-muted-foreground text-xs">
                                    {conversation.date}
                                  </span>
                                ) : null}
                                {conversation.unread ? (
                                  <Dot
                                    className="text-primary size-4"
                                    aria-label="Unread"
                                  />
                                ) : null}
                              </div>
                            }
                          />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                )}
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </CommandRoot>
      </Sidebar>
    </Sidebar>
  )
}
