"use client"

import {
  createMutationService,
  createQueryService,
  defineMutation,
  defineQuery,
} from "@/utils/caller"
import {
  notificationPageSchema,
  notificationSchema,
  notificationUpdateResultSchema,
  unreadNotificationCountSchema,
  type Notification,
  type NotificationPage,
} from "@/schemas/client/notification"


interface ListNotificationsInput {
  enabled: boolean
  limit: number
  offset: number
  unread?: boolean
}

export const notificationQueryKeys = {
  all: ["notification"] as const,
  list: (input: Omit<ListNotificationsInput, "enabled">) =>
    ["notification", "list", input] as const,
  unreadCount: ["notification", "unread-count"] as const,
}

const notificationsService = defineQuery<NotificationPage, ListNotificationsInput>(
  {
    queryKey: ({ limit, offset, unread }: ListNotificationsInput) =>
      notificationQueryKeys.list({ limit, offset, unread }),
    query: ({ limit, offset, unread }: ListNotificationsInput) => ({
      url: "/external/notification",
      baseURL: null,
      method: "GET",
      params: { limit, offset, unread },
      unwrapData: false,
      schema: notificationPageSchema,
      cache: "no-store",
    }),
    queryOptions: ({ enabled }: ListNotificationsInput) => ({
      enabled,
      retry: false,
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    }),
  }
)

const unreadCountService = defineQuery<{ count: number }, { enabled: boolean }>({
  queryKey: notificationQueryKeys.unreadCount,
  query: {
    url: "/external/notification/count",
    baseURL: null,
    method: "GET",
    unwrapData: false,
    schema: unreadNotificationCountSchema,
    cache: "no-store",
  },
  queryOptions: ({ enabled }: { enabled: boolean }) => ({
    enabled,
    retry: false,
    staleTime: 15_000,
    refetchInterval: (query) =>
      enabled && !query.state.error ? 30_000 : false,
    refetchOnWindowFocus: true,
  }),
})

const markReadService = defineMutation<{ updated: number }, string | undefined>({
  query: (id: string | undefined) => ({
    url: "/external/notification/read",
    baseURL: null,
    method: "PATCH",
    params: id ? { id } : undefined,
    unwrapData: false,
    schema: notificationUpdateResultSchema,
    toast: {
      error: "Unable to mark notifications as read",
    },
  }),
  invalidates: [notificationQueryKeys.all],
})

const archiveService = defineMutation<Notification, string>({
  query: (id: string) => ({
    url: "/external/notification/archive",
    baseURL: null,
    method: "PATCH",
    params: { id },
    schema: notificationSchema,
    toast: {
      error: "Unable to archive notification",
    },
  }),
  invalidates: [notificationQueryKeys.all],
})

const deleteService = defineMutation<null, string>({
  query: (id: string) => ({
    url: "/external/notification",
    baseURL: null,
    method: "DELETE",
    params: { id },
    unwrapData: false,
    toast: {
      error: "Unable to delete notification",
    },
  }),
  invalidates: [notificationQueryKeys.all],
})

const useNotifications = createQueryService(notificationsService)
const useUnreadCount = createQueryService(unreadCountService)
const useMarkRead = createMutationService(markReadService)
const useArchive = createMutationService(archiveService)
const useDelete = createMutationService(deleteService)

export function useNotificationsQuery(
  enabled: boolean,
  limit = 12,
  offset = 0,
  unread?: boolean
) {
  return useNotifications({ enabled, limit, offset, unread })
}

export function useUnreadNotificationCountQuery(enabled: boolean) {
  return useUnreadCount({ enabled })
}

export function useMarkNotificationReadMutation() {
  return useMarkRead()
}

export function useArchiveNotificationMutation() {
  return useArchive()
}

export function useDeleteNotificationMutation() {
  return useDelete()
}
