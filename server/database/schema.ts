import { relations, sql } from "drizzle-orm"
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
import {
  conversationMemberRoleOptions,
  conversationTypeOptions,
  messageDeliveryStatusOptions,
  messageTypeOptions,
} from "@/schemas/chat"

export const conversationTypeEnum = pgEnum("conversation_type_enum", conversationTypeOptions)

export const conversationMemberRoleEnum = pgEnum(
  "conversation_member_role_enum",
  conversationMemberRoleOptions,
)

export const messageTypeEnum = pgEnum("message_type_enum", messageTypeOptions)

export const messageDeliveryStatusEnum = pgEnum(
  "message_delivery_status_enum",
  messageDeliveryStatusOptions,
)

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalUserId: text("external_user_id").unique(),
    name: text("name").notNull().default(""),
    email: varchar("email", { length: 255 }).notNull().unique(),
    image: text("image"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (table) => [index("users_last_seen_at_idx").on(table.lastSeenAt)],
)

export const conversationsTable = pgTable(
  "conversations",
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
    uniqueIndex("conversations_slug_key").on(table.slug),
    index("conversations_created_by_id_idx").on(table.createdById),
  ],
)

export const messagesTable = pgTable(
  "messages",
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
    index("messages_conversation_created_at_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    index("messages_sender_id_idx").on(table.senderId),
    index("messages_deleted_at_idx").on(table.deletedAt),
  ],
)

export const conversationMembersTable = pgTable(
  "conversation_members",
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
      { onDelete: "set null" },
    ),
    mutedUntil: timestamp("muted_until", { mode: "date" }),
    joinedAt: timestamp("joined_at", { mode: "date" }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "conversation_members_pk",
      columns: [table.conversationId, table.userId],
    }),
    index("conversation_members_user_id_idx").on(table.userId),
    index("conversation_members_last_read_message_id_idx").on(
      table.lastReadMessageId,
    ),
  ],
)

export const messageAttachmentsTable = pgTable(
  "message_attachments",
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
  (table) => [
    index("message_attachments_message_id_idx").on(table.messageId),
  ],
)

export const messageReactionsTable = pgTable(
  "message_reactions",
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
    uniqueIndex("message_reactions_message_user_emoji_key").on(
      table.messageId,
      table.userId,
      table.emoji,
    ),
    index("message_reactions_user_id_idx").on(table.userId),
  ],
)

export const messageReceiptsTable = pgTable(
  "message_receipts",
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
    uniqueIndex("message_receipts_message_user_key").on(
      table.messageId,
      table.userId,
    ),
    index("message_receipts_user_status_idx").on(table.userId, table.status),
  ],
)

export const usersRelations = relations(usersTable, ({ many }) => ({
  createdConversations: many(conversationsTable),
  memberships: many(conversationMembersTable),
  messages: many(messagesTable),
  reactions: many(messageReactionsTable),
  receipts: many(messageReceiptsTable),
}))

export const conversationsRelations = relations(conversationsTable, ({ one, many }) => ({
  createdBy: one(usersTable, {
    fields: [conversationsTable.createdById],
    references: [usersTable.id],
  }),
  members: many(conversationMembersTable),
  messages: many(messagesTable),
}))

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
  }),
)

export const messageAttachmentsRelations = relations(
  messageAttachmentsTable,
  ({ one }) => ({
    message: one(messagesTable, {
      fields: [messageAttachmentsTable.messageId],
      references: [messagesTable.id],
    }),
  }),
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
  }),
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
  }),
)

export type UserRow = typeof usersTable.$inferSelect
export type ConversationRow = typeof conversationsTable.$inferSelect
export type ConversationMemberRow = typeof conversationMembersTable.$inferSelect
export type MessageRow = typeof messagesTable.$inferSelect
export type MessageAttachmentRow = typeof messageAttachmentsTable.$inferSelect
export type MessageReactionRow = typeof messageReactionsTable.$inferSelect
export type MessageReceiptRow = typeof messageReceiptsTable.$inferSelect
