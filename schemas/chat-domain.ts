import { z } from "@gorth-io/structure/cores/zod"
import { sql } from "drizzle-orm"

export const chatId = z.string().uuid()
export const chatPageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().max(512).optional(),
  q: z.string().trim().max(200).default(""),
})
export const startConversationSchema = z.object({
  type: z.enum(["direct", "group", "channel"]).default("direct"),
  title: z.string().trim().min(1).max(200).optional(),
  participantIds: z.array(chatId).max(99).default([]),
})
export const sendChatMessageSchema = z
  .object({
    content: z.string().trim().max(4000).default(""),
    clientMessageId: chatId,
    assetIds: z.array(chatId).max(10).default([]),
  })
  .refine((input) => input.content.length > 0 || input.assetIds.length > 0, {
    message: "A message needs text or an attachment",
  })
export const editChatMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  version: z.number().int().positive(),
})
export const memberChangeSchema = z.object({
  userId: chatId,
  role: z.enum(["owner", "admin", "member"]).default("member"),
})
export const memberPreferencesSchema = z.object({
  mutedUntil: z.coerce.date().nullable(),
})
export const memberRoleSchema = memberChangeSchema.omit({ userId: true })
export const reactionInputSchema = z.object({
  emoji: z.string().trim().min(1).max(32),
})
export const receiptInputSchema = z.object({
  status: z.enum(["delivered", "read"]).default("read"),
})
export const attachmentInputSchema = z.object({ assetId: chatId })
export const uploadInputSchema = z.object({
  bucket: chatId,
  filename: z.string().trim().min(1).max(255),
  contentType: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "text/plain",
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "video/mp4",
    "video/webm",
  ]),
  size: z
    .number()
    .int()
    .min(1)
    .max(25 * 1024 * 1024),
})
export const callStartSchema = z.object({
  kind: z.enum(["audio", "video"]),
  clientId: chatId,
})
export const callSignalSchema = z.object({
  clientId: chatId,
  kind: z.enum(["offer", "answer", "ice", "accept", "reject", "end"]),
  payload: z.string().max(65536).default(""),
})
export const reportInputSchema = z.object({
  reason: z.string().trim().min(1).max(128),
  details: z.string().trim().max(2000).default(""),
})
export const changeConversationSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  archived: z.boolean().optional(),
})
export const signalCursorSchema = z.object({
  after: z
    .string()
    .regex(/^\d{1,18}$/)
    .default("0"),
})
export const storageRequestSchema = z.object({
  bucketName: z.string().min(1).max(255),
})

// A deleted message never retains content/metadata in the API projection.
export const chatMessageProjection = sql`m.id, m.conversation_id AS "conversationId",
  COALESCE((SELECT max(e.sequence) FROM chat_event e WHERE e.entity_id=m.id),0)::text AS "syncVersion",
  m.client_message_id AS "clientMessageId", m.version,
  CASE WHEN m.deleted_at IS NULL THEN m.content ELSE '' END AS content,
  m.type, CASE WHEN m.deleted_at IS NULL THEN m.metadata-'requestFingerprint' ELSE '{}'::jsonb END AS metadata,
  to_char(m.edited_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "editedAt", to_char(m.deleted_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "deletedAt",
  to_char(m.created_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt", to_char(m.updated_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt",
  json_build_object('id', COALESCE(u.external_user_id, m.sender_id::text, ''),
    'name', COALESCE(u.name, 'Deleted user'), 'email', NULL) AS "user"`

export interface ChatMembership extends Record<string, unknown> {
  user_id: string
  role: "owner" | "admin" | "member"
  joined_at: Date
}
export interface ChatMessageRecord extends Record<string, unknown> {
  id: string
  conversationId: string
  createdAt: string
  syncVersion: string
  version: number
}

export const chatMessageDetailsProjection = sql`${chatMessageProjection},
  CASE WHEN m.deleted_at IS NOT NULL THEN '[]'::json ELSE COALESCE((SELECT json_agg(json_build_object('id',a.id,'fileName',a.file_name,'mimeType',a.mime_type,'sizeBytes',a.size_bytes,'fileUrl','/chat/attachment/'||a.id||'/download')) FROM message_attachment a WHERE a.message_id=m.id),'[]'::json) END AS attachments,
  COALESCE((SELECT json_agg(json_build_object('id',r.id,'userId',r.user_id,'emoji',r.emoji)) FROM message_reaction r WHERE r.message_id=m.id),'[]'::json) AS reactions,
  COALESCE((SELECT json_agg(json_build_object('userId',r.user_id,'status',r.status)) FROM message_receipt r WHERE r.message_id=m.id),'[]'::json) AS receipts`
