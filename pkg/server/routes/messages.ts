import { Router } from "@/lib/http"
import {
  createConversationMessage,
  createRoomMessage,
  deleteMessage,
  getMessage,
  listConversationMessages,
  listRoomMessages,
  updateMessage,
} from "@/controllers/messages"
import { requireAuth } from "@/middlewares/auth"

export function messagesRoutes() {
  const router = Router()
  router.get(
    "/conversation/:conversationId/message",
      requireAuth(),
    listConversationMessages
  )
  router.post(
    "/conversation/:conversationId/message",
      requireAuth(),
    createConversationMessage
  )
  router.get("/message/:messageId", requireAuth(), getMessage)
  router.patch("/message/:messageId", requireAuth(), updateMessage)
  router.delete("/message/:messageId", requireAuth(), deleteMessage)
  router.get("/room/:roomName/message", requireAuth(), listRoomMessages)
  router.post("/room/:roomName/message", requireAuth(), createRoomMessage)
  return router
}
