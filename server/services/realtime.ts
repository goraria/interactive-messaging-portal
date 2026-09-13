import type { TokenRequest } from "@gorth/structure/cores/ably/index"

import type { UserRow } from "@/database/schema"
import { getAbly } from "@/lib/ably"
import { createServiceError } from "@/lib/utils/service"

type MessageEvent = "message.created" | "message.updated" | "message.deleted"

export function getMessageChannelName(conversationId: string) {
  return `chat:message:${conversationId}`
}

export async function createConversationToken(
  conversationId: string,
  user: UserRow
): Promise<TokenRequest> {
  try {
    return await getAbly().auth.createTokenRequest({
      clientId: user.id,
      ttl: 60 * 60 * 1000,
      capability: {
        [getMessageChannelName(conversationId)]: ["subscribe"],
      },
    })
  } catch (error) {
    console.error("[ably] Token request failed", {
      conversationId,
      message: error instanceof Error ? error.message : "unknown_error",
    })
    throw createServiceError(503, "realtime_unavailable")
  }
}

export async function publishMessageEvent(
  conversationId: string,
  event: MessageEvent,
  messageId: string,
  message: unknown
) {
  try {
    await getAbly()
      .channels.get(getMessageChannelName(conversationId))
      .publish(event, { conversationId, messageId, message })
  } catch (error) {
    console.error("[ably] Message publish failed", {
      conversationId,
      event,
      message: error instanceof Error ? error.message : "unknown_error",
    })
  }
}
