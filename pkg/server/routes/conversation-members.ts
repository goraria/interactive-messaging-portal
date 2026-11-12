import { Router } from "@/lib/http"
import {
  addConversationMember,
  listConversationMembers,
  removeConversationMember,
  updateConversationMember,
} from "@/controllers/conversation-members"
import { requireAuth } from "@/middlewares/auth"

export function conversationMembersRoutes() {
  const router = Router()
  router.get("/conversation/:conversationId/member", requireAuth(), listConversationMembers)
  router.post("/conversation/:conversationId/member", requireAuth(), addConversationMember)
  router.patch(
    "/conversation/:conversationId/member/:userId",
      requireAuth(),
    updateConversationMember
  )
  router.delete(
    "/conversation/:conversationId/member/:userId",
      requireAuth(),
    removeConversationMember
  )
  return router
}
