import "server-only"
import type { z } from "@gorth-io/structure/cores/zod"
import {
  chatAssetInfoSchema,
  chatStorageConfigurationSchema,
} from "@/schemas/chat-platform"
import { sql } from "drizzle-orm"
import { getDatabase } from "@/database"
import {
  chatRows,
  checkConversationAccess,
  checkMessageAccess,
} from "@/services/helper"
import { chatPlatformRequest } from "@/services/chat-platform"
import { createServiceError } from "@/utils/service"
import * as env from "@/utils/environment"
import { uploadInputSchema } from "@/schemas/chat-domain"

export async function inspectChatAsset(
  assetId: string,
  conversationId: string,
  ownerExternalUserId: string
) {
  return chatAssetInfoSchema.parse(
    await chatPlatformRequest("media", "/media/chat/asset", "POST", {
      assetId,
      conversationId,
      ownerExternalUserId,
    })
  )
}
export async function createChatUpload(
  conversationId: string,
  userId: string,
  token: string,
  input: z.infer<typeof uploadInputSchema>
) {
  await checkConversationAccess(getDatabase(), conversationId, userId, true)
  return chatPlatformRequest<{
    asset: { id: string }
    upload: { id: string; url: string; headers: Record<string, string> }
  }>(
    "media",
    "/media/upload",
    "POST",
    {
      ...input,
      type: input.contentType.startsWith("image/")
        ? "image"
        : input.contentType.startsWith("audio/")
          ? "audio"
          : input.contentType.startsWith("video/")
            ? "video"
            : "attachment",
      visibility: "private",
      resourceType: "conversation",
      resourceId: conversationId,
      multipart: false,
      metadata: {},
    },
    token
  )
}
export async function finishChatUpload(
  conversationId: string,
  userId: string,
  token: string,
  uploadId: string,
  abort = false
) {
  await checkConversationAccess(getDatabase(), conversationId, userId, !abort)
  const session = await chatPlatformRequest<{
    asset: { resourceType: string; resourceId: string; application: string }
  }>("media", `/media/upload/${uploadId}`, "GET", undefined, token)
  if (
    session.asset.application !== "chat" ||
    session.asset.resourceType !== "conversation" ||
    session.asset.resourceId !== conversationId
  )
    throw createServiceError(403, "invalid_upload_binding")
  return chatPlatformRequest(
    "media",
    `/media/upload/${uploadId}/${abort ? "abort" : "complete"}`,
    "POST",
    {},
    token
  )
}
export async function downloadChatAttachment(id: string, userId: string) {
  const [attachment] = await chatRows(
    sql`SELECT * FROM message_attachment WHERE id=${id}::uuid`
  )
  if (!attachment?.media_asset_id)
    throw createServiceError(404, "attachment_unavailable")
  const { message } = await checkMessageAccess(
    String(attachment.message_id),
    userId
  )
  if (message.deleted_at) throw createServiceError(404, "message_deleted")
  const result = await chatPlatformRequest<{ url: string; expiresIn: number }>(
    "media",
    "/media/chat/asset-url",
    "POST",
    {
      assetId: attachment.media_asset_id,
      conversationId: message.conversation_id,
    }
  )
  const target = new URL(result.url)
  if (
    target.username ||
    target.password ||
    (target.protocol !== "https:" &&
      (env.isProduction ||
        target.protocol !== "http:" ||
        !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)))
  )
    throw createServiceError(503, "invalid_asset_url")
  return result
}
export function chatStorageCredential(bucketName: string) {
  const config = chatStorageConfigurationSchema.safeParse({
    endpoint: env.awsEndpointUrlS3,
    region: env.awsRegion,
    bucketName: env.awsBucket,
    accessKeyId: env.awsAccessKeyId,
    secretAccessKey: env.awsSecretAccessKey,
  })
  if (!config.success) throw createServiceError(503, "storage_not_configured")
  const endpoint = new URL(config.data.endpoint)
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== "/" ||
    bucketName !== config.data.bucketName
  )
    throw createServiceError(403, "storage_profile_mismatch")
  return config.data
}
