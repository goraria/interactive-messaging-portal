import { Router } from "@/lib/http"

import { createConversationToken } from "@/controllers/realtime"
import { requireAuth } from "@/middlewares/auth"

export function realtimeRoutes() {
  const router = Router()
  router.get(
    "/conversation/:conversationId/realtime/token",
    requireAuth(),
    createConversationToken
  )
  return router
}
