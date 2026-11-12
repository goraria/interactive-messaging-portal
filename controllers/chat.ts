import type { Context } from "hono"
import type { ApiEnv } from "@/utils/interface"
import { getVerifiedUser, getParam, parseBody } from "@/utils/controller"
import { getCurrentUserRow } from "@/services/users"
import { readAppCredentials } from "@/services/session"
import { createServiceError } from "@/utils/service"
import * as schema from "@/schemas/chat-domain"
import {
  listChatConversations as listChatConversationsServices,
  getChatConversation as getChatConversationServices,
  startChatConversation as startChatConversationServices,
  changeChatConversation as changeChatConversationServices,
  listChatMembers as listChatMembersServices,
  changeChatMember as changeChatMemberServices,
  setChatMute as setChatMuteServices,
  setChatBlock as setChatBlockServices,
} from "@/services/chat-conversations"
import {
  listChatMessages as listChatMessagesServices,
  getChatMessage as getChatMessageServices,
  sendChatMessage as sendChatMessageServices,
  editChatMessage as editChatMessageServices,
  deleteChatMessage as deleteChatMessageServices,
  reactChatMessage as reactChatMessageServices,
  acknowledgeChatMessage as acknowledgeChatMessageServices,
  replayChatEvents as replayChatEventsServices,
} from "@/services/chat-messages"
import {
  createChatUpload as createChatUploadServices,
  finishChatUpload as finishChatUploadServices,
  downloadChatAttachment as downloadChatAttachmentServices,
  chatStorageCredential as chatStorageCredentialServices,
} from "@/services/chat-media"
import {
  listChatCalls as listChatCallsServices,
  startChatCall as startChatCallServices,
  signalChatCall as signalChatCallServices,
  listChatSignals as listChatSignalsServices,
  chatIceConfiguration as chatIceConfigurationServices,
} from "@/services/chat-calls"
import { dispatchChatEvents as dispatchChatEventsServices } from "@/services/chat-delivery"
import { incomingChatCalls as incomingChatCallsServices } from "@/services/chat-calls"
import { retryChatDelivery as retryChatDeliveryServices } from "@/services/chat-delivery-status"
import { chatDeliveryStatus as chatDeliveryStatusServices } from "@/services/chat-delivery-status"
import { searchChatMessages as searchChatMessagesServices } from "@/services/chat-search"
import { reportChatMessage as reportChatMessageServices } from "@/services/chat-reports"
import { archiveChatConversation as archiveChatConversationServices } from "@/services/chat-conversations"

async function actor(context: Context<ApiEnv>) {
  const auth = getVerifiedUser(context)
  if (!auth) throw createServiceError(401, "unauthorized")
  return getCurrentUserRow(auth)
}
async function delegatedToken(context: Context<ApiEnv>) {
  const bearer = context.req.header("authorization")
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7)
  const credentials = await readAppCredentials(context.req.raw.headers)
  if (!credentials) throw createServiceError(401, "unauthorized")
  return credentials.credentials.accessToken
}
function id(context: Context<ApiEnv>, name = "conversationId") {
  return schema.chatId.parse(getParam(context, name))
}
export async function listChatConversations(context: Context<ApiEnv>) {
  const user = await actor(context)
  const query = schema.chatPageSchema.parse(context.req.query())
  return context.json(
    { data: await listChatConversationsServices(user.id, query.limit) },
    200
  )
}
export async function getChatConversation(context: Context<ApiEnv>) {
  const user = await actor(context)
  return context.json(
    { data: await getChatConversationServices(id(context), user.id) },
    200
  )
}
export async function startChatConversation(context: Context<ApiEnv>) {
  const user = await actor(context)
  return context.json(
    {
      data: await startChatConversationServices(
        user.id,
        await parseBody(schema.startConversationSchema, context)
      ),
    },
    201
  )
}
export async function changeChatConversation(context: Context<ApiEnv>) {
  const user = await actor(context)
  return context.json(
    {
      data: await changeChatConversationServices(
        id(context),
        user.id,
        await parseBody(schema.changeConversationSchema, context)
      ),
    },
    200
  )
}
export async function archiveChatConversation(context: Context<ApiEnv>) {
  const user = await actor(context)
  return context.json(
    {
      data: await archiveChatConversationServices(id(context), user.id),
    },
    200
  )
}
export async function listChatMembers(context: Context<ApiEnv>) {
  const user = await actor(context)
  return context.json(
    { data: await listChatMembersServices(id(context), user.id) },
    200
  )
}
export async function changeChatMember(context: Context<ApiEnv>) {
  const user = await actor(context)
  const operation =
    context.req.method === "POST"
      ? "add"
      : context.req.method === "DELETE"
        ? "remove"
        : "role"
  const input =
    operation === "remove"
      ? { userId: id(context, "userId"), role: "member" as const }
      : operation === "role"
        ? {
            ...(await parseBody(schema.memberRoleSchema, context)),
            userId: id(context, "userId"),
          }
        : await parseBody(schema.memberChangeSchema, context)
  return context.json(
    {
      data: await changeChatMemberServices(
        id(context),
        user.id,
        input.userId,
        operation,
        input.role
      ),
    },
    200
  )
}
export async function setChatMute(context: Context<ApiEnv>) {
  const user = await actor(context)
  const input = await parseBody(schema.memberPreferencesSchema, context)
  return context.json(
    { data: await setChatMuteServices(id(context), user.id, input.mutedUntil) },
    200
  )
}
export async function setChatBlock(context: Context<ApiEnv>) {
  const user = await actor(context)
  return context.json(
    {
      data: await setChatBlockServices(
        user.id,
        id(context, "userId"),
        context.req.method === "POST"
      ),
    },
    200
  )
}
export async function listChatMessages(context: Context<ApiEnv>) {
  const user = await actor(context)
  return context.json(
    await listChatMessagesServices(
      id(context),
      user.id,
      schema.chatPageSchema.parse(context.req.query())
    ),
    200
  )
}
export async function getChatMessage(context: Context<ApiEnv>) {
  const user = await actor(context)
  return context.json(
    { data: await getChatMessageServices(id(context, "messageId"), user.id) },
    200
  )
}
export async function sendChatMessage(context: Context<ApiEnv>) {
  const user = await actor(context)
  return context.json(
    {
      data: await sendChatMessageServices(
        id(context),
        user.id,
        user.externalUserId,
        await parseBody(schema.sendChatMessageSchema, context)
      ),
    },
    201
  )
}
export async function editChatMessage(context: Context<ApiEnv>) {
  const user = await actor(context)
  const input = await parseBody(schema.editChatMessageSchema, context)
  return context.json(
    {
      data: await editChatMessageServices(
        id(context, "messageId"),
        user.id,
        input.content,
        input.version
      ),
    },
    200
  )
}
export async function deleteChatMessage(context: Context<ApiEnv>) {
  const user = await actor(context)
  return context.json(
    {
      data: await deleteChatMessageServices(id(context, "messageId"), user.id),
    },
    200
  )
}
export async function reactChatMessage(context: Context<ApiEnv>) {
  const user = await actor(context)
  const input = await parseBody(schema.reactionInputSchema, context)
  return context.json(
    {
      data: await reactChatMessageServices(
        id(context, "messageId"),
        user.id,
        input.emoji,
        context.req.method === "DELETE"
      ),
    },
    200
  )
}
export async function acknowledgeChatMessage(context: Context<ApiEnv>) {
  const user = await actor(context)
  const input = await parseBody(schema.receiptInputSchema, context)
  return context.json(
    {
      data: await acknowledgeChatMessageServices(
        id(context, "messageId"),
        user.id,
        input.status
      ),
    },
    200
  )
}
export async function replayChatEvents(context: Context<ApiEnv>) {
  const user = await actor(context)
  const cursor = schema.signalCursorSchema.parse(context.req.query())
  return context.json(
    {
      data: await replayChatEventsServices(id(context), user.id, cursor.after),
    },
    200
  )
}
export async function createChatUpload(context: Context<ApiEnv>) {
  const user = await actor(context)
  return context.json(
    {
      data: await createChatUploadServices(
        id(context),
        user.id,
        await delegatedToken(context),
        await parseBody(schema.uploadInputSchema, context)
      ),
    },
    201
  )
}
export async function finishChatUpload(context: Context<ApiEnv>) {
  const user = await actor(context)
  return context.json(
    {
      data: await finishChatUploadServices(
        id(context),
        user.id,
        await delegatedToken(context),
        id(context, "uploadId"),
        context.req.path.endsWith("/abort")
      ),
    },
    200
  )
}
export async function downloadChatAttachment(context: Context<ApiEnv>) {
  const user = await actor(context)
  const result = await downloadChatAttachmentServices(
    id(context, "attachmentId"),
    user.id
  )
  context.header("Referrer-Policy", "no-referrer")
  return context.redirect(result.url, 307)
}
export async function listChatCalls(context: Context<ApiEnv>) {
  const user = await actor(context)
  return context.json(
    { data: await listChatCallsServices(id(context), user.id) },
    200
  )
}
export async function incomingChatCalls(context: Context<ApiEnv>) {
  const user = await actor(context)
  return context.json({ data: await incomingChatCallsServices(user.id) }, 200)
}
export async function startChatCall(context: Context<ApiEnv>) {
  const user = await actor(context)
  const input = await parseBody(schema.callStartSchema, context)
  return context.json(
    {
      data: await startChatCallServices(
        id(context),
        user.id,
        input.kind,
        input.clientId
      ),
    },
    201
  )
}
export async function signalChatCall(context: Context<ApiEnv>) {
  const user = await actor(context)
  return context.json(
    {
      data: await signalChatCallServices(
        id(context, "callId"),
        user.id,
        await parseBody(schema.callSignalSchema, context)
      ),
    },
    200
  )
}
export async function listChatSignals(context: Context<ApiEnv>) {
  const user = await actor(context)
  const cursor = schema.signalCursorSchema.parse(context.req.query())
  return context.json(
    await listChatSignalsServices(id(context, "callId"), user.id, cursor.after),
    200
  )
}
export async function chatIceConfiguration(context: Context<ApiEnv>) {
  return context.json({ data: chatIceConfigurationServices() }, 200)
}
export async function dispatchChatEvents(context: Context<ApiEnv>) {
  return context.json(await dispatchChatEventsServices(), 200)
}
export async function retryChatDelivery(context: Context<ApiEnv>) {
  const user = await actor(context)
  return context.json(
    {
      data: await retryChatDeliveryServices(
        id(context),
        user.id,
        id(context, "eventId")
      ),
    },
    200
  )
}
export async function chatStorageCredential(context: Context<ApiEnv>) {
  const input = await parseBody(schema.storageRequestSchema, context)
  context.header("Cache-Control", "private, no-store")
  context.header("Pragma", "no-cache")
  return context.json(chatStorageCredentialServices(input.bucketName), 200)
}
export async function reportChatMessage(context: Context<ApiEnv>) {
  const user = await actor(context)
  const input = await parseBody(schema.reportInputSchema, context)
  return context.json(
    {
      data: await reportChatMessageServices(
        id(context, "messageId"),
        user.id,
        await delegatedToken(context),
        input
      ),
    },
    201
  )
}
export async function searchChatMessages(context: Context<ApiEnv>) {
  const user = await actor(context)
  const input = schema.chatPageSchema.parse(context.req.query())
  return context.json(
    {
      data: await searchChatMessagesServices(
        id(context),
        user.id,
        input.q,
        input.limit
      ),
    },
    200
  )
}
export async function chatDeliveryStatus(context: Context<ApiEnv>) {
  const user = await actor(context)
  return context.json(
    { data: await chatDeliveryStatusServices(id(context), user.id) },
    200
  )
}
