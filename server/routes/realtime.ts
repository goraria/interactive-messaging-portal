import { Router } from "express"

import { createConversationToken } from "@/controllers/realtime"
import { requireAuth } from "@/middlewares/auth"

export function realtimeRoutes() {
  const router = Router()
  router.get(
    "/conversations/:conversationId/realtime/token",
    requireAuth(),
    createConversationToken
  )
  return router
}
