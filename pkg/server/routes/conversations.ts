import { Router } from "@/lib/http"
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
  router.get("/conversation", requireAuth(), listConversations)
  router.post("/conversation", requireAuth(), createConversation)
  router.get("/conversation/:conversationId", requireAuth(), getConversation)
  router.patch("/conversation/:conversationId", requireAuth(), updateConversation)
  router.delete("/conversation/:conversationId", requireAuth(), deleteConversation)
  return router
}
