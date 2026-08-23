import type { Request, Response } from "express"
import { createMessageReactionSchema } from "@/schemas/chat"
import {
  createMessageReaction as createMessageReactionService,
  deleteMessageReaction as deleteMessageReactionService,
  getMessageReactionRow,
  listMessageReactions as listMessageReactionsService,
} from "@/services/message-reactions"
import { getMessageRow } from "@/services/messages"
import { assertActiveConversationMember } from "@/services/conversation-members"
import { getCurrentUserRow } from "@/services/users"
import {
  assertControllerAccess,
  getParam,
  getVerifiedUser,
  isAdmin,
  parseBody,
  sendControllerError,
  sendData,
} from "@/lib/utils/controller"

export async function listMessageReactions(
  request: Request,
  response: Response
) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const user = await getCurrentUserRow(authUser)
    const message = await getMessageRow(getParam(request, "messageId"))
    await assertActiveConversationMember(message.conversationId, user.id)
    return sendData(response, await listMessageReactionsService(message.id))
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function createMessageReaction(
  request: Request,
  response: Response
) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const user = await getCurrentUserRow(authUser)
    const message = await getMessageRow(getParam(request, "messageId"))
    await assertActiveConversationMember(message.conversationId, user.id)
    const input = parseBody(createMessageReactionSchema, request)
    assertControllerAccess(input.userId === user.id || isAdmin(response))
    return sendData(
      response,
      await createMessageReactionService(message.id, input),
      201
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function deleteMessageReaction(
  request: Request,
  response: Response
) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const user = await getCurrentUserRow(authUser)
    const reaction = await getMessageReactionRow(
      getParam(request, "reactionId")
    )
    const message = await getMessageRow(reaction.messageId)
    await assertActiveConversationMember(message.conversationId, user.id)
    assertControllerAccess(reaction.userId === user.id || isAdmin(response))
    return sendData(response, await deleteMessageReactionService(reaction.id))
  } catch (error) {
    return sendControllerError(response, error)
  }
}
