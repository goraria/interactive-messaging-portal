import type { Request, Response } from "express"
import {
  createConversationMemberSchema,
  updateConversationMemberSchema,
} from "@/schemas/chat"
import {
  addConversationMember as addConversationMemberService,
  assertActiveConversationMember,
  assertConversationManager,
  listConversationMembers as listConversationMembersService,
  removeConversationMember as removeConversationMemberService,
  updateConversationMember as updateConversationMemberService,
} from "@/services/conversation-members"
import { getConversationRow } from "@/services/conversations"
import { getCurrentUserRow } from "@/services/users"
import {
  getParam,
  getVerifiedUser,
  isAdmin,
  parseBody,
  sendControllerError,
  sendData,
} from "@/lib/utils/controller"

export async function listConversationMembers(
  request: Request,
  response: Response
) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const currentUser = await getCurrentUserRow(authUser)
    const conversation = await getConversationRow(
      getParam(request, "conversationId")
    )
    if (!isAdmin(response)) {
      await assertActiveConversationMember(conversation.id, currentUser.id)
    }
    return sendData(
      response,
      await listConversationMembersService(conversation.id)
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function addConversationMember(
  request: Request,
  response: Response
) {
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
      await addConversationMemberService(
        conversation.id,
        parseBody(createConversationMemberSchema, request)
      ),
      201
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function updateConversationMember(
  request: Request,
  response: Response
) {
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
      await updateConversationMemberService(
        conversation.id,
        getParam(request, "userId"),
        parseBody(updateConversationMemberSchema, request)
      )
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}

export async function removeConversationMember(
  request: Request,
  response: Response
) {
  try {
    const authUser = getVerifiedUser(response)
    if (!authUser) return response.status(401).json({ error: "unauthorized" })
    const currentUser = await getCurrentUserRow(authUser)
    const conversation = await getConversationRow(
      getParam(request, "conversationId")
    )
    if (!isAdmin(response)) {
      const targetUserId = getParam(request, "userId")
      if (targetUserId !== currentUser.id) {
        await assertConversationManager(conversation.id, currentUser.id)
      }
    }
    return sendData(
      response,
      await removeConversationMemberService(
        conversation.id,
        getParam(request, "userId")
      )
    )
  } catch (error) {
    return sendControllerError(response, error)
  }
}
