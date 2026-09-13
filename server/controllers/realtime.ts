import type { Request, Response } from "express"

import { assertActiveConversationMember } from "@/services/conversation-members"
import { getConversationRow } from "@/services/conversations"
import { createConversationToken as createConversationTokenService } from "@/services/realtime"
import { getCurrentUserRow } from "@/services/users"
import {
  getParam,
  getVerifiedUser,
  sendControllerError,
  sendData,
} from "@/lib/utils/controller"

export async function createConversationToken(
  request: Request,
  response: Response
) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })

    const user = await getCurrentUserRow(authUser)
    const conversation = await getConversationRow(
      getParam(request, "conversationId")
    )
    await assertActiveConversationMember(conversation.id, user.id)

    return sendData(
      response,
      await createConversationTokenService(conversation.id, user)
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}
