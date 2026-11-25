import "server-only";
import type { z } from "@gorth-com/structure/cores/zod";
import type { reportInputSchema } from "@/schemas/chat-domain";
import { rawCheckMessageAccess } from "@/models/index"
import { rawChatPlatformRequest } from "@/services/chat-platform";
export async function rawReportChatMessage(
  messageId: string,
  userId: string,
  userToken: string,
  input: z.infer<typeof reportInputSchema>,
) {
  await rawCheckMessageAccess(messageId, userId);
  return rawChatPlatformRequest(
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
    userToken,
  );
}
