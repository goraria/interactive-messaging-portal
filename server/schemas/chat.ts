import z from "@gorth/structure/cores/zod"

export const conversationTypeOptions = [
  "direct",
  "group",
  "channel",
] as const

export const conversationMemberRoleOptions = [
  "owner",
  "admin",
  "member",
] as const

export const messageTypeOptions = [
  "text",
  "system",
  "image",
  "file",
] as const

export const messageDeliveryStatusOptions = [
  "sent",
  "delivered",
  "read",
] as const

export const conversationTypeSchema = z.enum(conversationTypeOptions)
export const conversationMemberRoleSchema = z.enum(conversationMemberRoleOptions)
export const messageTypeSchema = z.enum(messageTypeOptions)
export const messageDeliveryStatusSchema = z.enum(messageDeliveryStatusOptions)

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
  lastSeenAt: nullableDateTimeSchema,
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

export const createUserSchema = z.object({
  externalUserId: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  image: z.string().optional(),
  metadata: metadataSchema.optional(),
})

export const updateUserSchema = createUserSchema.partial().extend({
  lastSeenAt: z.coerce.date().nullable().optional(),
})

export const createConversationSchema = z.object({
  slug: z.string().optional(),
  title: z.string().optional(),
  type: conversationTypeSchema.default("direct"),
  createdById: uuidSchema.optional(),
  metadata: metadataSchema.optional(),
})

export const updateConversationSchema = createConversationSchema.partial().extend({
  archivedAt: z.coerce.date().nullable().optional(),
})

export const createConversationMemberSchema = z.object({
  userId: uuidSchema,
  role: conversationMemberRoleSchema.default("member"),
})

export const updateConversationMemberSchema = z.object({
  role: conversationMemberRoleSchema.optional(),
  lastReadMessageId: uuidSchema.nullable().optional(),
  mutedUntil: z.coerce.date().nullable().optional(),
  leftAt: z.coerce.date().nullable().optional(),
})

export const createMessageSchema = z.object({
  senderId: uuidSchema,
  content: z.string().min(1).max(4000),
  type: messageTypeSchema.default("text"),
  metadata: metadataSchema.optional(),
})

export const createRoomMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  metadata: metadataSchema.optional(),
})

export const updateMessageSchema = z.object({
  content: z.string().min(1).max(4000).optional(),
  type: messageTypeSchema.optional(),
  metadata: metadataSchema.optional(),
  deletedAt: z.coerce.date().nullable().optional(),
})

export const createMessageAttachmentSchema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.string().optional(),
  metadata: metadataSchema.optional(),
})

export const updateMessageAttachmentSchema = createMessageAttachmentSchema.partial()

export const createMessageReactionSchema = z.object({
  userId: uuidSchema,
  emoji: z.string().min(1),
})

export const createMessageReceiptSchema = z.object({
  userId: uuidSchema,
  status: messageDeliveryStatusSchema.default("delivered"),
})

export const updateMessageReceiptSchema = z.object({
  status: messageDeliveryStatusSchema.optional(),
  deliveredAt: z.coerce.date().nullable().optional(),
  readAt: z.coerce.date().nullable().optional(),
})

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
