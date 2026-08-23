import { Router } from "express"
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
  router.use(requireAuth())
  router.get(
    "/conversations/:conversationId/messages",
    listConversationMessages
  )
  router.post(
    "/conversations/:conversationId/messages",
    createConversationMessage
  )
  router.get("/messages/:messageId", getMessage)
  router.patch("/messages/:messageId", updateMessage)
  router.delete("/messages/:messageId", deleteMessage)
  router.get("/rooms/:roomName/messages", listRoomMessages)
  router.post("/rooms/:roomName/messages", createRoomMessage)
  return router
}
