import { userTable } from "./auth";
export {
  userStatus,
  userTable,
  sessionTable,
  accountTable,
  verificationTable,
  legacySessionTable,
  legacyVerificationTable,
  rateLimitTable,
  revocationTable,
  proofTable,
} from "./auth";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm/_relations";
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
  integer,
  bigserial,
  check,
} from "drizzle-orm/pg-core";
export const conversationTypeOptions = ["direct", "group", "channel"] as const;

export const conversationMemberRoleOptions = [
  "owner",
  "admin",
  "member",
] as const;

export const messageTypeOptions = ["text", "system", "image", "file"] as const;

export const messageDeliveryStatusOptions = [
  "sent",
  "delivered",
  "read",
] as const;

export const conversationTypeEnum = pgEnum(
  "conversation_type_enum",
  conversationTypeOptions,
);

export const conversationMemberRoleEnum = pgEnum(
  "conversation_member_role_enum",
  conversationMemberRoleOptions,
);

export const messageTypeEnum = pgEnum("message_type_enum", messageTypeOptions);

export const messageDeliveryStatusEnum = pgEnum(
  "message_delivery_status_enum",
  messageDeliveryStatusOptions,
);

export const conversationsTable = pgTable(
  "conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    type: conversationTypeEnum("type").notNull().default("direct"),
    title: text("title"),
    createdById: uuid("created_by_id").references(() => userTable.id, {
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
  ],
);

export const messagesTable = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    type: messageTypeEnum("type").notNull().default("text"),
    content: text("content").notNull(),
    clientMessageId: uuid("client_message_id"),
    version: integer("version").notNull().default(1),
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
      table.createdAt,
    ),
    index("message_sender_id_idx").on(table.senderId),
    index("message_deleted_at_idx").on(table.deletedAt),
    uniqueIndex("message_client_id_key").on(
      table.conversationId,
      table.senderId,
      table.clientMessageId,
    ),
    index("message_history_cursor_idx").on(
      table.conversationId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

export const conversationMembersTable = pgTable(
  "conversation_member",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
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
      name: "conversation_member_pk",
      columns: [table.conversationId, table.userId],
    }),
    index("conversation_member_user_id_idx").on(table.userId),
    index("conversation_member_last_read_message_id_idx").on(
      table.lastReadMessageId,
    ),
  ],
);

export const messageAttachmentsTable = pgTable(
  "message_attachment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messagesTable.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mediaAssetId: uuid("media_asset_id"),
    fileUrl: text("file_url").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: text("size_bytes"),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("message_attachment_message_id_idx").on(table.messageId),
    uniqueIndex("message_attachment_asset_key")
      .on(table.mediaAssetId)
      .where(sql`${table.mediaAssetId} IS NOT NULL`),
  ],
);

export const messageReactionsTable = pgTable(
  "message_reaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messagesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("message_reaction_message_user_emoji_key").on(
      table.messageId,
      table.userId,
      table.emoji,
    ),
    index("message_reaction_user_id_idx").on(table.userId),
  ],
);

export const messageReceiptsTable = pgTable(
  "message_receipt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messagesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    status: messageDeliveryStatusEnum("status").notNull().default("delivered"),
    deliveredAt: timestamp("delivered_at", { mode: "date" }),
    readAt: timestamp("read_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("message_receipt_message_user_key").on(
      table.messageId,
      table.userId,
    ),
    index("message_receipt_user_status_idx").on(table.userId, table.status),
  ],
);

export const usersRelations = relations(userTable, ({ many }) => ({
  createdConversations: many(conversationsTable),
  memberships: many(conversationMembersTable),
  messages: many(messagesTable),
  reactions: many(messageReactionsTable),
  receipts: many(messageReceiptsTable),
}));

export const conversationsRelations = relations(
  conversationsTable,
  ({ one, many }) => ({
    createdBy: one(userTable, {
      fields: [conversationsTable.createdById],
      references: [userTable.id],
    }),
    members: many(conversationMembersTable),
    messages: many(messagesTable),
  }),
);

export const messagesRelations = relations(messagesTable, ({ one, many }) => ({
  conversation: one(conversationsTable, {
    fields: [messagesTable.conversationId],
    references: [conversationsTable.id],
  }),
  sender: one(userTable, {
    fields: [messagesTable.senderId],
    references: [userTable.id],
  }),
  attachments: many(messageAttachmentsTable),
  reactions: many(messageReactionsTable),
  receipts: many(messageReceiptsTable),
}));

export const conversationMembersRelations = relations(
  conversationMembersTable,
  ({ one }) => ({
    conversation: one(conversationsTable, {
      fields: [conversationMembersTable.conversationId],
      references: [conversationsTable.id],
    }),
    user: one(userTable, {
      fields: [conversationMembersTable.userId],
      references: [userTable.id],
    }),
  }),
);

export const messageAttachmentsRelations = relations(
  messageAttachmentsTable,
  ({ one }) => ({
    message: one(messagesTable, {
      fields: [messageAttachmentsTable.messageId],
      references: [messagesTable.id],
    }),
  }),
);

export const messageReactionsRelations = relations(
  messageReactionsTable,
  ({ one }) => ({
    message: one(messagesTable, {
      fields: [messageReactionsTable.messageId],
      references: [messagesTable.id],
    }),
    user: one(userTable, {
      fields: [messageReactionsTable.userId],
      references: [userTable.id],
    }),
  }),
);

export const messageReceiptsRelations = relations(
  messageReceiptsTable,
  ({ one }) => ({
    message: one(messagesTable, {
      fields: [messageReceiptsTable.messageId],
      references: [messagesTable.id],
    }),
    user: one(userTable, {
      fields: [messageReceiptsTable.userId],
      references: [userTable.id],
    }),
  }),
);

export type UserRow = typeof userTable.$inferSelect;
export type ConversationRow = typeof conversationsTable.$inferSelect;
export type ConversationMemberRow =
  typeof conversationMembersTable.$inferSelect;
export type MessageRow = typeof messagesTable.$inferSelect;
export type MessageAttachmentRow = typeof messageAttachmentsTable.$inferSelect;
export type MessageReactionRow = typeof messageReactionsTable.$inferSelect;
export type MessageReceiptRow = typeof messageReceiptsTable.$inferSelect;

export const chatEventsTable = pgTable(
  "chat_event",
  {
    sequence: bigserial("sequence", { mode: "bigint" }).primaryKey(),
    id: uuid("id").notNull().unique().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    entityId: uuid("entity_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("chat_event_replay_idx").on(table.conversationId, table.sequence),
    index("chat_event_entity_idx").on(table.entityId, table.sequence.desc()),
  ],
);
export const chatDeliveriesTable = pgTable(
  "chat_delivery",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => chatEventsTable.id, { onDelete: "cascade" }),
    destination: text("destination").notNull(),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    leaseToken: uuid("lease_token"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    lastError: text("last_error"),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.destination] }),
    check(
      "chat_delivery_destination_check",
      sql`${table.destination} IN ('realtime','notification','insight','discovery')`,
    ),
    index("chat_delivery_pending_idx")
      .on(table.availableAt)
      .where(sql`${table.deliveredAt} IS NULL`),
  ],
);
export const chatBlocksTable = pgTable(
  "chat_block",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.targetId] }),
    check("chat_block_check", sql`${table.userId}<>${table.targetId}`),
  ],
);
export const chatCallsTable = pgTable(
  "chat_call",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    callerId: uuid("caller_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    calleeId: uuid("callee_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull(),
    kind: text("kind").notNull(),
    state: text("state").notNull().default("ringing"),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now()+interval '60 seconds'`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("chat_call_caller_id_client_id_key").on(
      table.callerId,
      table.clientId,
    ),
    uniqueIndex("chat_call_live_idx")
      .on(table.conversationId)
      .where(sql`${table.state} IN ('ringing','active')`),
    check("chat_call_kind_check", sql`${table.kind} IN ('audio','video')`),
    check(
      "chat_call_state_check",
      sql`${table.state} IN ('ringing','active','ended','rejected','missed')`,
    ),
  ],
);
export const chatSignalsTable = pgTable(
  "chat_signal",
  {
    sequence: bigserial("sequence", { mode: "bigint" }).primaryKey(),
    callId: uuid("call_id")
      .notNull()
      .references(() => chatCallsTable.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull(),
    kind: text("kind").notNull(),
    payload: text("payload").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("chat_signal_call_id_sender_id_client_id_key").on(
      table.callId,
      table.senderId,
      table.clientId,
    ),
    check(
      "chat_signal_kind_check",
      sql`${table.kind} IN ('offer','answer','ice','accept','reject','end')`,
    ),
  ],
);
