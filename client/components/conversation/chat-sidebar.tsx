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
} from "@gorth/primitive/custom/sidebar"
import { Button } from "@gorth/primitive/custom/button"
import { Label } from "@gorth/primitive/default/label"
import { Switch } from "@gorth/primitive/default/switch"
import {
  Command as CommandRoot,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@gorth/primitive/custom/command"
import { NavUser } from "@gorth/primitive/modules/dashboard"
import {
  Command as CommandIcon,
  MessageCircleOff,
  Search,
  SearchX,
  SquarePen,
  TriangleAlert,
  X,
  type LucideIcon,
} from "@gorth/primitive/cores/lucide"
import { ConversationItem } from "@/components/conversation/message/conversation-item"
import { ConversationState } from "@/components/conversation/conversation-state"
import type { ChatConversation } from "@/lib/utils/constant"
import type { useAuth } from "@/hooks/use-auth"

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
}

export function ChatSidebar({
  data,
  auth,
  conversationsLoading = false,
  conversationsError = null,
  ...props
}: ChatSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [activeItem, setActiveItem] = React.useState(data.navMain[0])
  const [unreadOnly, setUnreadOnly] = React.useState(false)
  const [searching, setSearching] = React.useState(false)
  const { setOpen } = useSidebar()
  const conversations = React.useMemo(
    () =>
      unreadOnly
        ? data.navMessage.filter((conversation) => conversation.unread)
        : data.navMessage,
    [data.navMessage, unreadOnly]
  )

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
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

        <SidebarFooter className="">
          <NavUser
            // className="group-data-[collapsible=icon]:p-0!"
            user={data.user}
            type="sidebar"
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
                    description={conversationsError}
                  />
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
                                <ConversationItem
                                  name={conversation.name}
                                  description={conversation.teaser}
                                  avatar={conversation.avatar}
                                  date={conversation.date}
                                  unread={conversation.unread}
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
                          <ConversationItem
                            name={conversation.name}
                            description={conversation.teaser}
                            avatar={conversation.avatar}
                            date={conversation.date}
                            unread={conversation.unread}
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
