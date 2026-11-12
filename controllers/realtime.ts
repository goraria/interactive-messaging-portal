import type { Context } from "hono"
import type { ApiEnv } from "@/utils/interface"
import { checkConversationAccess } from "@/services/helper"
import { getDatabase } from "@/database"
import { chatId } from "@/schemas/chat-domain"
import { createConversationToken as createConversationTokenServices } from "@/services/realtime"
import { getCurrentUserRow } from "@/services/users"
import { getParam, getVerifiedUser } from "@/utils/controller"
export async function createConversationToken(context: Context<ApiEnv>) {
  try {
    const authUser = getVerifiedUser(context)
    if (!authUser) return context.json({ error: "unauthorized" }, 401)
    const user = await getCurrentUserRow(authUser)
    const conversationId = chatId.parse(getParam(context, "conversationId"))
    await checkConversationAccess(getDatabase(), conversationId, user.id)
    return context.json(
      { data: await createConversationTokenServices(conversationId) },
      200
    )
  } catch (error) {
    throw error
  }
}
