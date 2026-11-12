import "server-only"
import type { z } from "@gorth-io/structure/cores/zod"
import type { reportInputSchema } from "@/schemas/chat-domain"
import { checkMessageAccess } from "@/services/helper"
import { chatPlatformRequest } from "@/services/chat-platform"
export async function reportChatMessage(
  messageId: string,
  userId: string,
  userToken: string,
  input: z.infer<typeof reportInputSchema>
) {
  await checkMessageAccess(messageId, userId)
  return chatPlatformRequest(
    "resource",
    "/resource/report",
    "POST",
    {
      targetType: "chat_message",
      targetId: messageId,
      reason: input.reason,
      details: input.details,
      metadata: {},
    },
    userToken
  )
}
