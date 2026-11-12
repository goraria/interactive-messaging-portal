import { z } from "@gorth/structure/cores/zod"

export const notificationPrioritySchema = z.enum([
  "low",
  "normal",
  "high",
  "urgent",
])

const nullableTimestampSchema = z.string().nullable()

export const notificationSchema = z.object({
  id: z.string().uuid(),
  recipientUserId: z.string().uuid(),
  application: z.string(),
  notificationType: z.string(),
  actorExternalUserId: z.string().nullable(),
  resourceType: z.string().nullable(),
  resourceId: z.string().nullable(),
  title: z.string(),
  body: z.string().nullable(),
  actionUrl: z.string().nullable(),
  priority: notificationPrioritySchema,
  payload: z.record(z.string(), z.unknown()),
  deduplicationKey: z.string().nullable(),
  readAt: nullableTimestampSchema,
  archivedAt: nullableTimestampSchema,
  expiresAt: nullableTimestampSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const notificationPageSchema = z.object({
  data: z.array(notificationSchema),
  pagination: z.object({
    limit: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  }),
})

export const unreadNotificationCountSchema = z.object({
  count: z.number().int().nonnegative(),
})

export const notificationUpdateResultSchema = z.object({
  updated: z.number().int().nonnegative(),
})

export type Notification = z.infer<typeof notificationSchema>
export type NotificationPage = z.infer<typeof notificationPageSchema>
export type NotificationPriority = z.infer<typeof notificationPrioritySchema>
