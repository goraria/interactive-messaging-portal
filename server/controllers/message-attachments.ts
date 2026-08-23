import type { Request, Response } from "express"
import {
  createMessageAttachmentSchema,
  updateMessageAttachmentSchema,
} from "@/schemas/chat"
import {
  createMessageAttachment as createMessageAttachmentService,
  deleteMessageAttachment as deleteMessageAttachmentService,
  getMessageAttachmentRow,
  listMessageAttachments as listMessageAttachmentsService,
  updateMessageAttachment as updateMessageAttachmentService,
} from "@/services/message-attachments"
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

export async function listMessageAttachments(
  request: Request,
  response: Response
) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const user = await getCurrentUserRow(authUser)
    const message = await getMessageRow(getParam(request, "messageId"))
    await assertActiveConversationMember(message.conversationId, user.id)
    return sendData(response, await listMessageAttachmentsService(message.id))
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function createMessageAttachment(
  request: Request,
  response: Response
) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const user = await getCurrentUserRow(authUser)
    const message = await getMessageRow(getParam(request, "messageId"))
    await assertActiveConversationMember(message.conversationId, user.id)
    assertControllerAccess(message.senderId === user.id || isAdmin(response))
    return sendData(
      response,
      await createMessageAttachmentService(
        message.id,
        parseBody(createMessageAttachmentSchema, request)
      ),
      201
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function updateMessageAttachment(
  request: Request,
  response: Response
) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const user = await getCurrentUserRow(authUser)
    const attachment = await getMessageAttachmentRow(
      getParam(request, "attachmentId")
    )
    const message = await getMessageRow(attachment.messageId)
    await assertActiveConversationMember(message.conversationId, user.id)
    assertControllerAccess(message.senderId === user.id || isAdmin(response))
    return sendData(
      response,
      await updateMessageAttachmentService(
        attachment.id,
        parseBody(updateMessageAttachmentSchema, request)
      )
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function deleteMessageAttachment(
  request: Request,
  response: Response
) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const user = await getCurrentUserRow(authUser)
    const attachment = await getMessageAttachmentRow(
      getParam(request, "attachmentId")
    )
    const message = await getMessageRow(attachment.messageId)
    await assertActiveConversationMember(message.conversationId, user.id)
    assertControllerAccess(message.senderId === user.id || isAdmin(response))
    return sendData(
      response,
      await deleteMessageAttachmentService(attachment.id)
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}
