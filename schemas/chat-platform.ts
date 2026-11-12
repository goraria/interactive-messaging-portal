import { z } from "@gorth-io/structure/cores/zod"
import { uploadInputSchema } from "@/schemas/chat-domain"
export const chatGrantSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().min(1).max(600),
})
export const chatAssetInfoSchema = z.object({
  id: z.string().uuid(),
  filename: z.string().min(1).max(255),
  contentType: uploadInputSchema.shape.contentType,
  size: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024),
})
export const chatStorageConfigurationSchema = z.object({
  endpoint: z.string().url(),
  region: z.string().min(1),
  bucketName: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
})
export const chatSearchResultSchema = z.object({
  data: z.array(z.object({ resourceId: z.string().uuid() })).max(100),
})
