import type { Request, Response } from "express"
import { createRoomMessageSchema, updateMessageSchema } from "@/schemas/chat"
import {
  createConversationMessage as createConversationMessageService,
  deleteMessage as deleteMessageService,
  getMessage as getMessageService,
  getMessageRow,
  listConversationMessages as listConversationMessagesService,
  updateMessage as updateMessageService,
} from "@/services/messages"
import {
  ensureConversation,
  getConversationRow,
} from "@/services/conversations"
import {
  assertActiveConversationMember,
  ensureConversationMember,
} from "@/services/conversation-members"
import { ensureUser, getCurrentUserRow } from "@/services/users"
import {
  assertControllerAccess,
  getParam,
  getVerifiedUser,
  isAdmin,
  parseBody,
  parseListLimit,
  sendControllerError,
  sendData,
} from "@/lib/utils/controller"

export async function listConversationMessages(
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
      await listConversationMessagesService(
        conversation,
        parseListLimit(request)
      )
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function createConversationMessage(
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
      await createConversationMessageService(
        conversation,
        user,
        parseBody(createRoomMessageSchema, request)
      ),
      201
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function getMessage(request: Request, response: Response) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const user = await getCurrentUserRow(authUser)
    const message = await getMessageRow(getParam(request, "messageId"))
    await assertActiveConversationMember(message.conversationId, user.id)
    return sendData(response, await getMessageService(message.id))
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function updateMessage(request: Request, response: Response) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const user = await getCurrentUserRow(authUser)
    const message = await getMessageRow(getParam(request, "messageId"))
    await assertActiveConversationMember(message.conversationId, user.id)
    assertControllerAccess(message.senderId === user.id || isAdmin(response))
    return sendData(
      response,
      await updateMessageService(
        message.id,
        parseBody(updateMessageSchema, request)
      )
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function deleteMessage(request: Request, response: Response) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const user = await getCurrentUserRow(authUser)
    const message = await getMessageRow(getParam(request, "messageId"))
    await assertActiveConversationMember(message.conversationId, user.id)
    assertControllerAccess(message.senderId === user.id || isAdmin(response))
    return sendData(response, await deleteMessageService(message.id))
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function listRoomMessages(request: Request, response: Response) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const user = await getCurrentUserRow(authUser)
    const conversation = await getConversationRow(getParam(request, "roomName"))
    await assertActiveConversationMember(conversation.id, user.id)
    return sendData(
      response,
      await listConversationMessagesService(
        conversation,
        parseListLimit(request)
      )
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function createRoomMessage(request: Request, response: Response) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })

    const user = await ensureUser(authUser)
    const conversation = await ensureConversation(
      getParam(request, "roomName"),
      user
    )
    await ensureConversationMember(conversation, user)
    return sendData(
      response,
      await createConversationMessageService(
        conversation,
        user,
        parseBody(createRoomMessageSchema, request)
      ),
      201
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}
