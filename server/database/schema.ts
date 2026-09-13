import { sql } from "drizzle-orm"
import { relations } from "drizzle-orm/_relations"
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
export const conversationTypeOptions = ["direct", "group", "channel"] as const

export const conversationMemberRoleOptions = [
  "owner",
  "admin",
  "member",
] as const

export const messageTypeOptions = ["text", "system", "image", "file"] as const

export const messageDeliveryStatusOptions = [
  "sent",
  "delivered",
  "read",
] as const

export const conversationTypeEnum = pgEnum(
  "conversation_type_enum",
  conversationTypeOptions
)

export const conversationMemberRoleEnum = pgEnum(
  "conversation_member_role_enum",
  conversationMemberRoleOptions
)

export const messageTypeEnum = pgEnum("message_type_enum", messageTypeOptions)

export const messageDeliveryStatusEnum = pgEnum(
  "message_delivery_status_enum",
  messageDeliveryStatusOptions
)

export const userStatus = pgEnum("user_status", [
  "active",
  "inactive",
  "suspended",
  "deleted",
])

export const usersTable = pgTable(
  "user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalUserId: text("external_user_id").notNull().unique(),
    name: text("name").notNull().default(""),
    username: varchar("username", { length: 64 }),
    role: varchar("role", { length: 32 }).notNull().default("user"),
    status: userStatus("status").notNull().default("active"),
    email: varchar("email", { length: 255 }).notNull().unique(),
    image: text("image"),
    banExpires: timestamp("ban_expires", {
      mode: "date",
      withTimezone: true,
    }),
    bannedAt: timestamp("banned_at", { mode: "date", withTimezone: true }),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'::jsonb`),
    lastSeenAt: timestamp("last_seen_at", {
      mode: "date",
      withTimezone: true,
    }),
    syncedAt: timestamp("synced_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("user_last_seen_at_idx").on(table.lastSeenAt),
    index("user_external_user_id_idx").on(table.externalUserId),
    index("user_status_idx").on(table.status),
    uniqueIndex("user_username_lower_key").on(sql`lower(${table.username})`),
  ]
)

export const conversationsTable = pgTable(
  "conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    type: conversationTypeEnum("type").notNull().default("direct"),
    title: text("title"),
    createdById: uuid("created_by_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'::jsonb`),
    archivedAt: timestamp("archived_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("conversation_slug_key").on(table.slug),
    index("conversation_created_by_id_idx").on(table.createdById),
  ]
)

export const messagesTable = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    type: messageTypeEnum("type").notNull().default("text"),
    content: text("content").notNull(),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'::jsonb`),
    editedAt: timestamp("edited_at", { mode: "date" }),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("message_conversation_created_at_idx").on(
      table.conversationId,
      table.createdAt
    ),
    index("message_sender_id_idx").on(table.senderId),
    index("message_deleted_at_idx").on(table.deletedAt),
  ]
)

export const conversationMembersTable = pgTable(
  "conversation_member",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: conversationMemberRoleEnum("role").notNull().default("member"),
    lastReadMessageId: uuid("last_read_message_id").references(
      () => messagesTable.id,
      { onDelete: "set null" }
    ),
    mutedUntil: timestamp("muted_until", { mode: "date" }),
    joinedAt: timestamp("joined_at", { mode: "date" }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "conversation_member_pk",
      columns: [table.conversationId, table.userId],
    }),
    index("conversation_member_user_id_idx").on(table.userId),
    index("conversation_member_last_read_message_id_idx").on(
      table.lastReadMessageId
    ),
  ]
)

export const messageAttachmentsTable = pgTable(
  "message_attachment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messagesTable.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: text("size_bytes"),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("message_attachment_message_id_idx").on(table.messageId)]
)

export const messageReactionsTable = pgTable(
  "message_reaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messagesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("message_reaction_message_user_emoji_key").on(
      table.messageId,
      table.userId,
      table.emoji
    ),
    index("message_reaction_user_id_idx").on(table.userId),
  ]
)

export const messageReceiptsTable = pgTable(
  "message_receipt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messagesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: messageDeliveryStatusEnum("status").notNull().default("delivered"),
    deliveredAt: timestamp("delivered_at", { mode: "date" }),
    readAt: timestamp("read_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("message_receipt_message_user_key").on(
      table.messageId,
      table.userId
    ),
    index("message_receipt_user_status_idx").on(table.userId, table.status),
  ]
)

export const usersRelations = relations(usersTable, ({ many }) => ({
  createdConversations: many(conversationsTable),
  memberships: many(conversationMembersTable),
  messages: many(messagesTable),
  reactions: many(messageReactionsTable),
  receipts: many(messageReceiptsTable),
}))

export const conversationsRelations = relations(
  conversationsTable,
  ({ one, many }) => ({
    createdBy: one(usersTable, {
      fields: [conversationsTable.createdById],
      references: [usersTable.id],
    }),
    members: many(conversationMembersTable),
    messages: many(messagesTable),
  })
)

export const messagesRelations = relations(messagesTable, ({ one, many }) => ({
  conversation: one(conversationsTable, {
    fields: [messagesTable.conversationId],
    references: [conversationsTable.id],
  }),
  sender: one(usersTable, {
    fields: [messagesTable.senderId],
    references: [usersTable.id],
  }),
  attachments: many(messageAttachmentsTable),
  reactions: many(messageReactionsTable),
  receipts: many(messageReceiptsTable),
}))

export const conversationMembersRelations = relations(
  conversationMembersTable,
  ({ one }) => ({
    conversation: one(conversationsTable, {
      fields: [conversationMembersTable.conversationId],
      references: [conversationsTable.id],
    }),
    user: one(usersTable, {
      fields: [conversationMembersTable.userId],
      references: [usersTable.id],
    }),
  })
)

export const messageAttachmentsRelations = relations(
  messageAttachmentsTable,
  ({ one }) => ({
    message: one(messagesTable, {
      fields: [messageAttachmentsTable.messageId],
      references: [messagesTable.id],
    }),
  })
)

export const messageReactionsRelations = relations(
  messageReactionsTable,
  ({ one }) => ({
    message: one(messagesTable, {
      fields: [messageReactionsTable.messageId],
      references: [messagesTable.id],
    }),
    user: one(usersTable, {
      fields: [messageReactionsTable.userId],
      references: [usersTable.id],
    }),
  })
)

export const messageReceiptsRelations = relations(
  messageReceiptsTable,
  ({ one }) => ({
    message: one(messagesTable, {
      fields: [messageReceiptsTable.messageId],
      references: [messagesTable.id],
    }),
    user: one(usersTable, {
      fields: [messageReceiptsTable.userId],
      references: [usersTable.id],
    }),
  })
)

export type UserRow = typeof usersTable.$inferSelect
export type ConversationRow = typeof conversationsTable.$inferSelect
export type ConversationMemberRow = typeof conversationMembersTable.$inferSelect
export type MessageRow = typeof messagesTable.$inferSelect
export type MessageAttachmentRow = typeof messageAttachmentsTable.$inferSelect
export type MessageReactionRow = typeof messageReactionsTable.$inferSelect
export type MessageReceiptRow = typeof messageReceiptsTable.$inferSelect
