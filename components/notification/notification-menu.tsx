"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@gorth-io/primitive/custom/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@gorth-io/primitive/default/popover"
import { ScrollArea } from "@gorth-io/primitive/default/scroll-area"
import { Separator } from "@gorth-io/primitive/default/separator"
import { Skeleton } from "@gorth-io/primitive/default/skeleton"
import {
  Archive,
  Bell,
  CheckCheck,
  Inbox,
  RefreshCw,
} from "@gorth-io/primitive/cores/lucide"
import { cn } from "@gorth-io/primitive/cores/cn"
import type { Notification } from "@/schemas/client/notification"
import {
  useArchiveNotificationMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
  useUnreadNotificationCountQuery,
} from "@/services/client/notification"

interface NotificationMenuProps {
  enabled: boolean
}

function resolveActionPath(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) return null

  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : null
  } catch {
    return null
  }
}

function formatNotificationTime(value: string) {
  const createdAt = new Date(value).getTime()
  const elapsed = Date.now() - createdAt

  if (!Number.isFinite(createdAt)) return ""
  if (elapsed < 60_000) return "Now"
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m`
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h`
  if (elapsed < 604_800_000) return `${Math.floor(elapsed / 86_400_000)}d`

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(createdAt))
}

function NotificationItem({
  notification,
  onOpen,
  onArchive,
  busy,
}: {
  notification: Notification
  onOpen: (notification: Notification) => void
  onArchive: (id: string) => void
  busy: boolean
}) {
  const unread = notification.readAt === null

  return (
    <div
      className={cn(
        "group flex items-start gap-2 border-b px-3 py-3 last:border-b-0",
        unread && "bg-primary/5"
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
        onClick={() => onOpen(notification)}
      >
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
            unread
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Bell className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span
              className={cn(
                "line-clamp-2 flex-1 text-sm",
                unread && "font-medium"
              )}
            >
              {notification.title}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatNotificationTime(notification.createdAt)}
            </span>
          </span>
          {notification.body ? (
            <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {notification.body}
            </span>
          ) : null}
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground opacity-70 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        aria-label={`Archive ${notification.title}`}
        disabled={busy}
        onClick={() => onArchive(notification.id)}
      >
        <Archive className="size-4" />
      </Button>
    </div>
  )
}

function NotificationListSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-label="Loading notifications">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function NotificationMenu({ enabled }: NotificationMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [limit, setLimit] = useState(12)
  const countQuery = useUnreadNotificationCountQuery(enabled)
  const notificationsQuery = useNotificationsQuery(
    enabled && open && !countQuery.isError,
    limit
  )
  const [markRead, markReadState] = useMarkNotificationReadMutation()
  const [archive, archiveState] = useArchiveNotificationMutation()
  const unreadCount = countQuery.data?.count ?? 0
  const unavailable = countQuery.isError || notificationsQuery.isError
  const notifications = notificationsQuery.data?.data ?? []

  const handleOpen = async (notification: Notification) => {
    if (!notification.readAt) {
      await markRead(notification.id)
        .unwrap()
        .catch(() => undefined)
    }

    const actionPath = resolveActionPath(notification.actionUrl)
    if (actionPath) {
      setOpen(false)
      router.push(actionPath)
    }
  }

  const handleArchive = (id: string) => {
    void archive(id)
      .unwrap()
      .catch(() => undefined)
  }

  const handleMarkAllRead = () => {
    void markRead(undefined)
      .unwrap()
      .catch(() => undefined)
  }

  if (!enabled) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              unavailable
                ? "Notifications unavailable"
                : unreadCount
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
            }
          />
        }
      >
        <Bell />
        {!unavailable && unreadCount > 0 ? (
          <span className="text-destructive-foreground absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-medium">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0"
      >
        <PopoverHeader className="flex-row items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <PopoverTitle>Notifications</PopoverTitle>
            <PopoverDescription>
              {unavailable
                ? "Notification service unavailable"
                : unreadCount
                  ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                  : "You are all caught up"}
            </PopoverDescription>
          </div>
          {!unavailable && unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={markReadState.isLoading}
              onClick={handleMarkAllRead}
            >
              <CheckCheck />
              Mark all read
            </Button>
          ) : null}
        </PopoverHeader>
        <Separator />

        <ScrollArea className="h-[min(28rem,calc(100vh-10rem))] min-h-52">
          {unavailable ? (
            <div className="flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Notification service is unavailable. Please try again later.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  countQuery.isFetching || notificationsQuery.isFetching
                }
                onClick={() =>
                  void Promise.all([
                    countQuery.refetch(),
                    notificationsQuery.refetch(),
                  ])
                }
              >
                <RefreshCw />
                Try again
              </Button>
            </div>
          ) : notificationsQuery.isPending ? (
            <NotificationListSkeleton />
          ) : notifications.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Inbox className="size-5" />
              </span>
              <div>
                <p className="font-medium">No notifications yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  New Chat activity will appear here.
                </p>
              </div>
            </div>
          ) : (
            <>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onOpen={handleOpen}
                  onArchive={handleArchive}
                  busy={archiveState.isLoading}
                />
              ))}
              {notificationsQuery.data?.pagination.hasMore ? (
                <div className="p-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={notificationsQuery.isFetching || limit >= 100}
                    onClick={() =>
                      setLimit((current) => Math.min(current + 12, 100))
                    }
                  >
                    Load more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
