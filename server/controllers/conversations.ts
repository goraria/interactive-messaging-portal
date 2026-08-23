import type { Request, Response } from "express"
import type { ConversationRow, UserRow } from "@/database/schema"
import {
  createConversationSchema,
  updateConversationSchema,
} from "@/schemas/chat"
import {
  createConversation as createConversationService,
  deleteConversation as deleteConversationService,
  getConversationRow,
  listConversationsByIds,
  updateConversation as updateConversationService,
} from "@/services/conversations"
import {
  assertActiveConversationMember,
  assertConversationManager,
  addConversationMember,
  listActiveConversationIdsForUser,
  listConversationMemberUsers,
} from "@/services/conversation-members"
import { listLastMessagesForConversations } from "@/services/messages"
import { getCurrentUserRow } from "@/services/users"
import { toConversation, toMessage, toUser } from "@/lib/utils/chat"
import {
  getParam,
  getVerifiedUser,
  isAdmin,
  parseBody,
  parseListLimit,
  sendControllerError,
  sendData,
} from "@/lib/utils/controller"

async function loadConversationDetails(conversations: ConversationRow[]) {
  try {
    const conversationIds = conversations.map((conversation) => conversation.id)
    if (conversationIds.length === 0) return []

    const [memberRows, messageRows] = await Promise.all([
      listConversationMemberUsers(conversationIds),
      listLastMessagesForConversations(conversationIds),
    ])
    const members = new Map<string, UserRow[]>()
    const messages = new Map<string, (typeof messageRows)[number]>()

    for (const row of memberRows) {
      const values = members.get(row.conversationId) ?? []
      values.push(row.user)
      members.set(row.conversationId, values)
    }
    for (const row of messageRows) {
      messages.set(row.message.conversationId, row)
    }

    return conversations.map((conversation) => {
      const lastMessage = messages.get(conversation.id)
      return {
        ...toConversation(conversation),
        members: (members.get(conversation.id) ?? []).map(toUser),
        lastMessage: lastMessage
          ? toMessage(
              lastMessage.message,
              lastMessage.sender,
              lastMessage.conversation
            )
          : null,
      }
    })
  } catch (error) {
    throw error
  }
}

export async function listConversations(request: Request, response: Response) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })

    const limit = parseListLimit(request)
    const user = await getCurrentUserRow(authUser)
    const conversationIds = await listActiveConversationIdsForUser(
      user.id,
      limit
    )
    const conversations = await listConversationsByIds(conversationIds, limit)
    return sendData(response, await loadConversationDetails(conversations))
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function createConversation(request: Request, response: Response) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const currentUser = await getCurrentUserRow(authUser)
    const input = parseBody(createConversationSchema, request)
    const conversation = await createConversationService({
      ...input,
      createdById: currentUser.id,
    })
    await addConversationMember(conversation.id, {
      userId: currentUser.id,
      role: "owner",
    })
    return sendData(response, conversation, 201)
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function getConversation(request: Request, response: Response) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })

    const user = await getCurrentUserRow(authUser)
    const conversation = await getConversationRow(
      getParam(request, "conversationId")
    )
    await assertActiveConversationMember(conversation.id, user.id)
    const [details] = await loadConversationDetails([conversation])
    return sendData(response, details)
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function updateConversation(request: Request, response: Response) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const currentUser = await getCurrentUserRow(authUser)
    const conversation = await getConversationRow(
      getParam(request, "conversationId")
    )
    if (!isAdmin(response)) {
      await assertConversationManager(conversation.id, currentUser.id)
    }
    return sendData(
      response,
      await updateConversationService(
        conversation.id,
        parseBody(updateConversationSchema, request)
      )
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function deleteConversation(request: Request, response: Response) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const currentUser = await getCurrentUserRow(authUser)
    const conversation = await getConversationRow(
      getParam(request, "conversationId")
    )
    if (!isAdmin(response)) {
      await assertConversationManager(conversation.id, currentUser.id)
    }
    return sendData(response, await deleteConversationService(conversation.id))
  } catch (error) {
    return sendControllerError(response, error)
  }
}
