import type { Request, Response } from "express"
import {
  createMessageReceiptSchema,
  updateMessageReceiptSchema,
} from "@/schemas/chat"
import {
  createMessageReceipt as createMessageReceiptService,
  deleteMessageReceipt as deleteMessageReceiptService,
  getMessageReceiptRow,
  listMessageReceipts as listMessageReceiptsService,
  updateMessageReceipt as updateMessageReceiptService,
} from "@/services/message-receipts"
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

export async function listMessageReceipts(
  request: Request,
  response: Response
) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const user = await getCurrentUserRow(authUser)
    const message = await getMessageRow(getParam(request, "messageId"))
    await assertActiveConversationMember(message.conversationId, user.id)
    return sendData(response, await listMessageReceiptsService(message.id))
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function createMessageReceipt(
  request: Request,
  response: Response
) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const user = await getCurrentUserRow(authUser)
    const message = await getMessageRow(getParam(request, "messageId"))
    await assertActiveConversationMember(message.conversationId, user.id)
    const input = parseBody(createMessageReceiptSchema, request)
    assertControllerAccess(input.userId === user.id || isAdmin(response))
    return sendData(
      response,
      await createMessageReceiptService(message.id, input),
      201
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function updateMessageReceipt(
  request: Request,
  response: Response
) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const user = await getCurrentUserRow(authUser)
    const receipt = await getMessageReceiptRow(getParam(request, "receiptId"))
    const message = await getMessageRow(receipt.messageId)
    await assertActiveConversationMember(message.conversationId, user.id)
    assertControllerAccess(receipt.userId === user.id || isAdmin(response))
    return sendData(
      response,
      await updateMessageReceiptService(
        receipt.id,
        parseBody(updateMessageReceiptSchema, request)
      )
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function deleteMessageReceipt(
  request: Request,
  response: Response
) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const user = await getCurrentUserRow(authUser)
    const receipt = await getMessageReceiptRow(getParam(request, "receiptId"))
    const message = await getMessageRow(receipt.messageId)
    await assertActiveConversationMember(message.conversationId, user.id)
    assertControllerAccess(receipt.userId === user.id || isAdmin(response))
    return sendData(response, await deleteMessageReceiptService(receipt.id))
  } catch (error) {
    return sendControllerError(response, error)
  }
}
