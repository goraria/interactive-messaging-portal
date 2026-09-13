import z from "@gorth/structure/cores/zod"
import { createSchemaFactory } from "drizzle-orm/zod"
import {
  conversationMemberRoleOptions,
  conversationMembersTable,
  conversationsTable,
  conversationTypeOptions,
  messageAttachmentsTable,
  messageDeliveryStatusOptions,
  messageReactionsTable,
  messageReceiptsTable,
  messagesTable,
  messageTypeOptions,
  usersTable,
} from "@/database/schema"

export {
  conversationMemberRoleOptions,
  conversationTypeOptions,
  messageDeliveryStatusOptions,
  messageTypeOptions,
}

const { createInsertSchema, createUpdateSchema } = createSchemaFactory({
  zodInstance: z,
  coerce: { date: true },
})

export const userStatusOptions = [
  "active",
  "inactive",
  "suspended",
  "deleted",
] as const

export const conversationTypeSchema = z.enum(conversationTypeOptions)
export const conversationMemberRoleSchema = z.enum(conversationMemberRoleOptions)
export const messageTypeSchema = z.enum(messageTypeOptions)
export const messageDeliveryStatusSchema = z.enum(messageDeliveryStatusOptions)
export const userStatusSchema = z.enum(userStatusOptions)

export const uuidSchema = z.string().uuid()
export const dateTimeSchema = z.string().datetime()
export const metadataSchema = z.record(z.string(), z.unknown()).default({})
export const nullableDateTimeSchema = dateTimeSchema.nullable()

export const userSchema = z.object({
  id: uuidSchema,
  externalUserId: z.string(),
  name: z.string(),
  email: z.string().email(),
  image: z.string().nullable(),
  status: userStatusSchema,
  lastSeenAt: nullableDateTimeSchema,
  syncedAt: dateTimeSchema,
  metadata: metadataSchema,
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
})

export const conversationSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  type: conversationTypeSchema,
  title: z.string().nullable(),
  createdById: uuidSchema.nullable(),
  metadata: metadataSchema,
  archivedAt: nullableDateTimeSchema,
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
})

export const conversationMemberSchema = z.object({
  conversationId: uuidSchema,
  userId: uuidSchema,
  role: conversationMemberRoleSchema,
  lastReadMessageId: uuidSchema.nullable(),
  mutedUntil: nullableDateTimeSchema,
  joinedAt: dateTimeSchema,
  leftAt: nullableDateTimeSchema,
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
})

export const messageUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().nullable(),
})

export const messageSchema = z.object({
  id: uuidSchema,
  conversationId: uuidSchema,
  content: z.string(),
  type: messageTypeSchema,
  metadata: metadataSchema,
  user: messageUserSchema,
  roomName: z.string().optional(),
  editedAt: nullableDateTimeSchema,
  deletedAt: nullableDateTimeSchema,
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
})

export const conversationDetailsSchema = conversationSchema.extend({
  members: z.array(userSchema),
  lastMessage: messageSchema.nullable(),
})

export const messageAttachmentSchema = z.object({
  id: uuidSchema,
  messageId: uuidSchema,
  fileName: z.string(),
  fileUrl: z.string(),
  mimeType: z.string().nullable(),
  sizeBytes: z.string().nullable(),
  metadata: metadataSchema,
  createdAt: dateTimeSchema,
})

export const messageReactionSchema = z.object({
  id: uuidSchema,
  messageId: uuidSchema,
  userId: uuidSchema,
  emoji: z.string(),
  createdAt: dateTimeSchema,
})

export const messageReceiptSchema = z.object({
  id: uuidSchema,
  messageId: uuidSchema,
  userId: uuidSchema,
  status: messageDeliveryStatusSchema,
  deliveredAt: nullableDateTimeSchema,
  readAt: nullableDateTimeSchema,
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
})

const userInsertSchema = createInsertSchema(usersTable, {
  externalUserId: (schema) => schema.min(1),
  name: (schema) => schema.min(1),
  email: (schema) => schema.email(),
})

const authUserProjectionSchema = userInsertSchema.pick({
  externalUserId: true,
  name: true,
  username: true,
  email: true,
  image: true,
  status: true,
})

export const authUserSchema = z.object({
  id: authUserProjectionSchema.shape.externalUserId,
  name: authUserProjectionSchema.shape.name,
  username: authUserProjectionSchema.shape.username,
  email: authUserProjectionSchema.shape.email.optional(),
  image: authUserProjectionSchema.shape.image,
  status: authUserProjectionSchema.shape.status,
})

export const createUserSchema = userInsertSchema.pick({
  externalUserId: true,
  name: true,
  email: true,
  image: true,
  metadata: true,
})

export const updateUserSchema = createUpdateSchema(usersTable, {
  externalUserId: (schema) => schema.min(1),
  name: (schema) => schema.min(1),
  email: (schema) => schema.email(),
}).pick({
  externalUserId: true,
  name: true,
  email: true,
  image: true,
  metadata: true,
  lastSeenAt: true,
})

export const createConversationSchema = createInsertSchema(
  conversationsTable
)
  .pick({
    slug: true,
    title: true,
    type: true,
    createdById: true,
    metadata: true,
  })
  .partial({ slug: true })

export const updateConversationSchema = createUpdateSchema(
  conversationsTable
).pick({
  slug: true,
  title: true,
  type: true,
  createdById: true,
  metadata: true,
  archivedAt: true,
})

export const createConversationMemberSchema = createInsertSchema(
  conversationMembersTable
).pick({ userId: true, role: true })

export const updateConversationMemberSchema = createUpdateSchema(
  conversationMembersTable
).pick({
  role: true,
  lastReadMessageId: true,
  mutedUntil: true,
  leftAt: true,
})

const messageInsertSchema = createInsertSchema(messagesTable, {
  content: (schema) => schema.min(1).max(4000),
})

export const createMessageSchema = messageInsertSchema.pick({
  senderId: true,
  content: true,
  type: true,
  metadata: true,
})

export const createRoomMessageSchema = messageInsertSchema.pick({
  content: true,
  metadata: true,
})

export const updateMessageSchema = createUpdateSchema(messagesTable, {
  content: (schema) => schema.min(1).max(4000),
}).pick({
  content: true,
  type: true,
  metadata: true,
  deletedAt: true,
})

export const createMessageAttachmentSchema = createInsertSchema(
  messageAttachmentsTable,
  {
    fileName: (schema) => schema.min(1),
    fileUrl: (schema) => schema.min(1),
  }
).pick({
  fileName: true,
  fileUrl: true,
  mimeType: true,
  sizeBytes: true,
  metadata: true,
})

export const updateMessageAttachmentSchema = createUpdateSchema(
  messageAttachmentsTable,
  {
    fileName: (schema) => schema.min(1),
    fileUrl: (schema) => schema.min(1),
  }
).pick({
  fileName: true,
  fileUrl: true,
  mimeType: true,
  sizeBytes: true,
  metadata: true,
})

export const createMessageReactionSchema = createInsertSchema(
  messageReactionsTable,
  { emoji: (schema) => schema.min(1) }
).pick({ userId: true, emoji: true })

export const createMessageReceiptSchema = createInsertSchema(
  messageReceiptsTable
).pick({ userId: true, status: true })

export const updateMessageReceiptSchema = createUpdateSchema(
  messageReceiptsTable
).pick({ status: true, deliveredAt: true, readAt: true })

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const chatSchemas = {
  user: userSchema,
  conversation: conversationSchema,
  conversationDetails: conversationDetailsSchema,
  conversationMember: conversationMemberSchema,
  message: messageSchema,
  messageAttachment: messageAttachmentSchema,
  messageReaction: messageReactionSchema,
  messageReceipt: messageReceiptSchema,
}

export type ConversationType = z.infer<typeof conversationTypeSchema>
export type ConversationMemberRole = z.infer<typeof conversationMemberRoleSchema>
export type MessageType = z.infer<typeof messageTypeSchema>
export type MessageDeliveryStatus = z.infer<typeof messageDeliveryStatusSchema>
export type User = z.infer<typeof userSchema>
export type Conversation = z.infer<typeof conversationSchema>
export type ConversationDetails = z.infer<typeof conversationDetailsSchema>
export type ConversationMember = z.infer<typeof conversationMemberSchema>
export type Message = z.infer<typeof messageSchema>
export type MessageAttachment = z.infer<typeof messageAttachmentSchema>
export type MessageReaction = z.infer<typeof messageReactionSchema>
export type MessageReceipt = z.infer<typeof messageReceiptSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type CreateConversationInput = z.infer<typeof createConversationSchema>
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>
export type CreateConversationMemberInput = z.infer<typeof createConversationMemberSchema>
export type UpdateConversationMemberInput = z.infer<typeof updateConversationMemberSchema>
export type CreateMessageInput = z.infer<typeof createMessageSchema>
export type CreateRoomMessageInput = z.infer<typeof createRoomMessageSchema>
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>
export type CreateMessageAttachmentInput = z.infer<typeof createMessageAttachmentSchema>
export type UpdateMessageAttachmentInput = z.infer<typeof updateMessageAttachmentSchema>
export type CreateMessageReactionInput = z.infer<typeof createMessageReactionSchema>
export type CreateMessageReceiptInput = z.infer<typeof createMessageReceiptSchema>
export type UpdateMessageReceiptInput = z.infer<typeof updateMessageReceiptSchema>
export type AuthUserInput = z.infer<typeof authUserSchema>
