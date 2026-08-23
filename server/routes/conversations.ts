import { Router } from "express"
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  updateConversation,
} from "@/controllers/conversations"
import { requireAuth } from "@/middlewares/auth"

export function conversationsRoutes() {
  const router = Router()
  router.use(requireAuth())
  router.get("/conversations", listConversations)
  router.post("/conversations", createConversation)
  router.get("/conversations/:conversationId", getConversation)
  router.patch("/conversations/:conversationId", updateConversation)
  router.delete("/conversations/:conversationId", deleteConversation)
  return router
}
