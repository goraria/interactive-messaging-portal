import { Hono } from "hono"
import type { ApiEnv } from "@/utils/interface"
import { requireAuth } from "@/middlewares/auth"
import type { MiddlewareHandler } from "hono"
import { verifyChatBackend } from "@/services/chat-platform"
import * as controller from "@/controllers/chat"
export function requireChatMachine(storage = false): MiddlewareHandler<ApiEnv> {
  return async (context, next) => {
    await verifyChatBackend(context.req.raw, storage)
    await next()
  }
}
export function chatRoutes() {
  const router = new Hono<ApiEnv>()
  router.get("/conversation", requireAuth(), controller.listChatConversations)
  router.post("/conversation", requireAuth(), controller.startChatConversation)
  router.get(
    "/conversation/:conversationId",
    requireAuth(),
    controller.getChatConversation
  )
  router.patch(
    "/conversation/:conversationId",
    requireAuth(),
    controller.changeChatConversation
  )
  router.delete(
    "/conversation/:conversationId",
    requireAuth(),
    controller.archiveChatConversation
  )
  router.get(
    "/conversation/:conversationId/member",
    requireAuth(),
    controller.listChatMembers
  )
  router.post(
    "/conversation/:conversationId/member",
    requireAuth(),
    controller.changeChatMember
  )
  router.patch(
    "/conversation/:conversationId/member/:userId",
    requireAuth(),
    controller.changeChatMember
  )
  router.delete(
    "/conversation/:conversationId/member/:userId",
    requireAuth(),
    controller.changeChatMember
  )
  router.patch(
    "/conversation/:conversationId/preference",
    requireAuth(),
    controller.setChatMute
  )
  router.get(
    "/conversation/:conversationId/message",
    requireAuth(),
    controller.listChatMessages
  )
  router.post(
    "/conversation/:conversationId/message",
    requireAuth(),
    controller.sendChatMessage
  )
  router.get(
    "/conversation/:conversationId/event",
    requireAuth(),
    controller.replayChatEvents
  )
  router.get(
    "/conversation/:conversationId/search",
    requireAuth(),
    controller.searchChatMessages
  )
  router.get(
    "/conversation/:conversationId/delivery",
    requireAuth(),
    controller.chatDeliveryStatus
  )
  router.post(
    "/conversation/:conversationId/delivery/:eventId/retry",
    requireAuth(),
    controller.retryChatDelivery
  )
  router.post(
    "/conversation/:conversationId/upload",
    requireAuth(),
    controller.createChatUpload
  )
  router.post(
    "/conversation/:conversationId/upload/:uploadId/complete",
    requireAuth(),
    controller.finishChatUpload
  )
  router.post(
    "/conversation/:conversationId/upload/:uploadId/abort",
    requireAuth(),
    controller.finishChatUpload
  )
  router.get("/message/:messageId", requireAuth(), controller.getChatMessage)
  router.patch("/message/:messageId", requireAuth(), controller.editChatMessage)
  router.delete(
    "/message/:messageId",
    requireAuth(),
    controller.deleteChatMessage
  )
  router.post(
    "/message/:messageId/reaction",
    requireAuth(),
    controller.reactChatMessage
  )
  router.delete(
    "/message/:messageId/reaction",
    requireAuth(),
    controller.reactChatMessage
  )
  router.post(
    "/message/:messageId/receipt",
    requireAuth(),
    controller.acknowledgeChatMessage
  )
  router.post(
    "/message/:messageId/report",
    requireAuth(),
    controller.reportChatMessage
  )
  router.get(
    "/attachment/:attachmentId/download",
    requireAuth(),
    controller.downloadChatAttachment
  )
  router.post("/block/:userId", requireAuth(), controller.setChatBlock)
  router.delete("/block/:userId", requireAuth(), controller.setChatBlock)
  router.get(
    "/conversation/:conversationId/call",
    requireAuth(),
    controller.listChatCalls
  )
  router.post(
    "/conversation/:conversationId/call",
    requireAuth(),
    controller.startChatCall
  )
  router.get("/call/:callId/signal", requireAuth(), controller.listChatSignals)
  router.post("/call/:callId/signal", requireAuth(), controller.signalChatCall)
  router.get("/call/ice", requireAuth(), controller.chatIceConfiguration)
  router.get("/call/incoming", requireAuth(), controller.incomingChatCalls)
  router.post(
    "/event/dispatch",
    requireChatMachine(),
    controller.dispatchChatEvents
  )
  return router
}
export function chatInternalRoutes() {
  const router = new Hono<ApiEnv>()
  router.post(
    "/internal/storage/credential",
    requireChatMachine(true),
    controller.chatStorageCredential
  )
  return router
}
