import { z } from "@gorth-com/structure/cores/zod";
import { messageSchema } from "@/schemas/client/chat";
export const messengerMessageSchema = messageSchema.extend({
  version: z.number().int().default(1),
  syncVersion: z
    .string()
    .regex(/^\d{1,19}$/)
    .default("0"),
  clientMessageId: z.string().uuid().nullable().optional(),
  attachments: z
    .array(
      z.object({
        id: z.string().uuid(),
        fileName: z.string(),
        fileUrl: z.string(),
        mimeType: z.string().nullable(),
        sizeBytes: z.string().nullable(),
      }),
    )
    .default([]),
  reactions: z
    .array(
      z.object({
        id: z.string().uuid(),
        userId: z.string(),
        emoji: z.string(),
      }),
    )
    .default([]),
  receipts: z
    .array(z.object({ userId: z.string(), status: z.string() }))
    .default([]),
});
export const messengerPageSchema = z.object({
  data: z.array(messengerMessageSchema),
  eventCursor: z.string(),
  pagination: z.object({
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
  }),
});
export const messengerEventsSchema = z.array(
  z.object({
    id: z.string(),
    sequence: z.string(),
    type: z.string(),
    entityId: z.string(),
  }),
);
export type MessengerMessage = z.infer<typeof messengerMessageSchema>;
export const callSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  callerId: z.string(),
  calleeId: z.string(),
  kind: z.enum(["audio", "video"]),
  state: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
  endedAt: z.string().nullable(),
});
export type MessengerCall = z.infer<typeof callSchema>;
