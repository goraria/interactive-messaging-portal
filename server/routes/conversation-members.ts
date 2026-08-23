import { Router } from "express"
import {
  addConversationMember,
  listConversationMembers,
  removeConversationMember,
  updateConversationMember,
} from "@/controllers/conversation-members"
import { requireAuth } from "@/middlewares/auth"

export function conversationMembersRoutes() {
  const router = Router()
  router.use(requireAuth())
  router.get("/conversations/:conversationId/members", listConversationMembers)
  router.post("/conversations/:conversationId/members", addConversationMember)
  router.patch(
    "/conversations/:conversationId/members/:userId",
    updateConversationMember
  )
  router.delete(
    "/conversations/:conversationId/members/:userId",
    removeConversationMember
  )
  return router
}
